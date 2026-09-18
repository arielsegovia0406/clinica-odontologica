"use server";

import { and, desc, eq } from "drizzle-orm";
import {
  requireCapability,
  requireClinicContext,
} from "@/lib/auth/clinic-context";
import { canStartClinicalCare } from "@/lib/clinical/consent-rules";
import {
  computeCpoCeoFromOdontograma,
  computeIhos,
  emptyIhosPiezas,
  type CpoCeoResult,
  type IhosPiezaExaminada,
} from "@/lib/clinical/indices";
import type { Denticion, DienteState, OdontogramaSnapshot } from "@/lib/clinical/odontograma";
import { writeAudit } from "@/lib/db/audit";
import {
  consentimientos,
  indicadoresSaludBucal,
  indices,
  odontogramaCaras,
  odontogramaDientes,
  odontogramas,
  pacientes,
  visitas,
} from "@/lib/db/schema";
import { withTenant, type DbTransaction } from "@/lib/db/with-tenant";
import { newId } from "@/lib/ids";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type IndicesEditorPayload = {
  pacienteId: string;
  visitaId: string;
  odontogramaId: string | null;
  calculated: CpoCeoResult;
  stored: CpoCeoResult & {
    ihosPlaca: number | null;
    ihosCalculo: number | null;
    ihosGingivitis: number | null;
    sobrescritoManual: boolean;
    motivoSobrescritura: string | null;
  };
  piezasIhos: IhosPiezaExaminada[];
  ihosComputed: ReturnType<typeof computeIhos>;
};

async function loadOdoSnapshot(
  tx: DbTransaction,
  odontogramaId: string,
  denticion: Denticion,
): Promise<OdontogramaSnapshot> {
  const dientesRows = await tx
    .select()
    .from(odontogramaDientes)
    .where(eq(odontogramaDientes.odontogramaId, odontogramaId));
  const dientes: DienteState[] = [];
  for (const row of dientesRows) {
    const caras = await tx
      .select({
        cara: odontogramaCaras.cara,
        estado: odontogramaCaras.estado,
      })
      .from(odontogramaCaras)
      .where(eq(odontogramaCaras.dienteId, row.id));
    dientes.push({
      piezaFdi: row.piezaFdi,
      estadoPieza: row.estadoPieza,
      endodonciaIndicada: row.endodonciaIndicada,
      endodonciaRealizada: row.endodonciaRealizada,
      coronaIndicada: row.coronaIndicada,
      coronaRealizada: row.coronaRealizada,
      movilidad: row.movilidad as DienteState["movilidad"],
      recesion: row.recesion as DienteState["recesion"],
      notas: row.notas,
      caras,
    });
  }
  return { denticion, dientes };
}

export async function loadIndicesEditor(
  clinicaId: string,
  pacienteId: string,
): Promise<ActionResult<IndicesEditorPayload>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "indices_read");

  try {
    const data = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const pac = await tx
          .select({ id: pacientes.id })
          .from(pacientes)
          .where(eq(pacientes.id, pacienteId))
          .limit(1);
        if (!pac[0]) throw new Error("Paciente no encontrado");

        const consents = await tx
          .select({
            tipo: consentimientos.tipo,
            revocadoEn: consentimientos.revocadoEn,
            aceptadoEn: consentimientos.aceptadoEn,
          })
          .from(consentimientos)
          .where(eq(consentimientos.pacienteId, pacienteId));
        if (!canStartClinicalCare(consents)) {
          throw new Error(
            "Se requiere consentimiento vigente de tratamiento de datos",
          );
        }

        const draft = await tx
          .select()
          .from(visitas)
          .where(
            and(
              eq(visitas.pacienteId, pacienteId),
              eq(visitas.estado, "borrador"),
            ),
          )
          .orderBy(desc(visitas.createdAt))
          .limit(1);
        if (!draft[0]) {
          throw new Error("No hay visita en borrador — inicie atención primero");
        }
        const visita = draft[0];

        const odoRows = await tx
          .select()
          .from(odontogramas)
          .where(eq(odontogramas.visitaId, visita.id))
          .limit(1);
        const odo = odoRows[0] ?? null;

        let calculated: CpoCeoResult = {
          c: 0,
          p: 0,
          o: 0,
          cpoD: 0,
          cTemporal: 0,
          eTemporal: 0,
          oTemporal: 0,
          ceoD: 0,
        };
        let present = new Set<number>();
        if (odo) {
          const snap = await loadOdoSnapshot(
            tx,
            odo.id,
            odo.denticion as Denticion,
          );
          calculated = computeCpoCeoFromOdontograma(snap);
          present = new Set(snap.dientes.map((d) => d.piezaFdi));
        }

        let indRows = await tx
          .select()
          .from(indices)
          .where(eq(indices.visitaId, visita.id))
          .limit(1);

        if (!indRows[0]) {
          const id = newId("idx");
          await tx.insert(indices).values({
            id,
            clinicaId: ctx.clinicaId,
            visitaId: visita.id,
            ...calculated,
          });
          indRows = await tx
            .select()
            .from(indices)
            .where(eq(indices.id, id))
            .limit(1);
        }

        const storedRow = indRows[0]!;

        let indSalud = await tx
          .select()
          .from(indicadoresSaludBucal)
          .where(eq(indicadoresSaludBucal.visitaId, visita.id))
          .limit(1);

        if (!indSalud[0]) {
          const piezas = emptyIhosPiezas(present);
          const id = newId("isb");
          await tx.insert(indicadoresSaludBucal).values({
            id,
            clinicaId: ctx.clinicaId,
            visitaId: visita.id,
            piezasExaminadas: piezas,
          });
          indSalud = await tx
            .select()
            .from(indicadoresSaludBucal)
            .where(eq(indicadoresSaludBucal.id, id))
            .limit(1);
        }

        const piezasIhos = indSalud[0]!.piezasExaminadas as IhosPiezaExaminada[];
        const ihosComputed = computeIhos(piezasIhos);

        return {
          pacienteId,
          visitaId: visita.id,
          odontogramaId: odo?.id ?? null,
          calculated,
          stored: {
            c: storedRow.c,
            p: storedRow.p,
            o: storedRow.o,
            cpoD: storedRow.cpoD,
            cTemporal: storedRow.cTemporal,
            eTemporal: storedRow.eTemporal,
            oTemporal: storedRow.oTemporal,
            ceoD: storedRow.ceoD,
            ihosPlaca: storedRow.ihosPlaca
              ? Number(storedRow.ihosPlaca)
              : ihosComputed.ihosPlaca,
            ihosCalculo: storedRow.ihosCalculo
              ? Number(storedRow.ihosCalculo)
              : ihosComputed.ihosCalculo,
            ihosGingivitis: storedRow.ihosGingivitis
              ? Number(storedRow.ihosGingivitis)
              : ihosComputed.ihosGingivitis,
            sobrescritoManual: storedRow.sobrescritoManual,
            motivoSobrescritura: storedRow.motivoSobrescritura,
          },
          piezasIhos,
          ihosComputed,
        } satisfies IndicesEditorPayload;
      },
    );
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cargar índices",
    };
  }
}

export async function recalcularIndicesDesdeOdontogramaAction(
  clinicaId: string,
  visitaId: string,
): Promise<ActionResult<CpoCeoResult>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "indices_write");

  try {
    const result = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const odo = await tx
          .select()
          .from(odontogramas)
          .where(eq(odontogramas.visitaId, visitaId))
          .limit(1);
        if (!odo[0]) throw new Error("Sin odontograma en esta visita");
        const snap = await loadOdoSnapshot(
          tx,
          odo[0].id,
          odo[0].denticion as Denticion,
        );
        const calculated = computeCpoCeoFromOdontograma(snap);
        await tx
          .update(indices)
          .set({
            ...calculated,
            sobrescritoManual: false,
            sobrescritoPor: null,
            sobrescritoEn: null,
            motivoSobrescritura: null,
          })
          .where(eq(indices.visitaId, visitaId));
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "recalc_indices",
          entidad: "indices",
          entidadId: visitaId,
          valorNuevo: calculated,
        });
        return calculated;
      },
    );
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al recalcular",
    };
  }
}

export async function sobrescribirIndicesAction(
  clinicaId: string,
  visitaId: string,
  values: CpoCeoResult & { motivo: string },
): Promise<ActionResult> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "indices_write");
  if (!values.motivo.trim()) {
    return { ok: false, error: "Indique el motivo de sobrescritura" };
  }

  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        await tx
          .update(indices)
          .set({
            c: values.c,
            p: values.p,
            o: values.o,
            cpoD: values.c + values.p + values.o,
            cTemporal: values.cTemporal,
            eTemporal: values.eTemporal,
            oTemporal: values.oTemporal,
            ceoD: values.cTemporal + values.eTemporal + values.oTemporal,
            sobrescritoManual: true,
            sobrescritoPor: ctx.userId,
            sobrescritoEn: new Date(),
            motivoSobrescritura: values.motivo.trim(),
          })
          .where(eq(indices.visitaId, visitaId));
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "override_indices",
          entidad: "indices",
          entidadId: visitaId,
          valorNuevo: values,
        });
      },
    );
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al sobrescribir",
    };
  }
}

export async function saveIhosPiezasAction(
  clinicaId: string,
  visitaId: string,
  piezas: IhosPiezaExaminada[],
): Promise<ActionResult<ReturnType<typeof computeIhos>>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "indices_write");

  for (const p of piezas) {
    if (p.placa < 0 || p.placa > 3 || p.calculo < 0 || p.calculo > 3) {
      return { ok: false, error: "Placa/cálculo deben estar entre 0 y 3" };
    }
    if (p.gingivitis !== 0 && p.gingivitis !== 1) {
      return { ok: false, error: "Gingivitis debe ser 0 o 1" };
    }
  }

  try {
    const ihos = computeIhos(piezas);
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        await tx
          .update(indicadoresSaludBucal)
          .set({ piezasExaminadas: piezas })
          .where(eq(indicadoresSaludBucal.visitaId, visitaId));
        await tx
          .update(indices)
          .set({
            ihosPlaca: ihos.ihosPlaca?.toFixed(2) ?? null,
            ihosCalculo: ihos.ihosCalculo?.toFixed(2) ?? null,
            ihosGingivitis: ihos.ihosGingivitis?.toFixed(2) ?? null,
          })
          .where(eq(indices.visitaId, visitaId));
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "save_ihos",
          entidad: "indicadores_salud_bucal",
          entidadId: visitaId,
          valorNuevo: ihos,
        });
      },
    );
    return { ok: true, data: ihos };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar IHOS",
    };
  }
}
