"use server";

import { and, desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  requireCapability,
  requireClinicContext,
} from "@/lib/auth/clinic-context";
import {
  applyTransition,
  emptyDiente,
  emptyOdontograma,
  syncFlagsFromEstado,
  type CaraDental,
  type Denticion,
  type DienteState,
  type EstadoCara,
  type EstadoPieza,
  type OdontogramaSnapshot,
  type Transition,
  OdontogramaValidationError,
} from "@/lib/clinical/odontograma";
import { sugerirDenticionPorEdad, type GradoValor } from "@/lib/clinical/odontograma-config";
import { writeAudit } from "@/lib/db/audit";
import {
  consentimientos,
  odontogramaCaras,
  odontogramaDientes,
  odontogramaProtesis,
  odontogramas,
  pacientes,
  visitas,
} from "@/lib/db/schema";
import { withTenant, type DbTransaction } from "@/lib/db/with-tenant";
import { newId } from "@/lib/ids";
import { canStartClinicalCare } from "@/lib/clinical/consent-rules";
import { arePiezasContiguasMismoArco } from "@/lib/clinical/odontograma";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type TramoRow = {
  id: string;
  tipo: "fija" | "removible" | "total";
  piezasOrdenadas: number[];
  estado: string | null;
};

export type OdontogramaEditorPayload = {
  pacienteId: string;
  visitaId: string;
  odontogramaId: string;
  denticion: Denticion;
  denticionSugerida: Denticion;
  inmutable: boolean;
  snapshot: OdontogramaSnapshot;
  reference: OdontogramaSnapshot | null;
  referenceVisitaId: string | null;
  tramos: TramoRow[];
  capturadoPor: string | null;
  responsableId: string | null;
};

function ageYears(born: Date): number {
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

async function loadSnapshotForOdontograma(
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
      movilidad: row.movilidad as GradoValor | null,
      recesion: row.recesion as GradoValor | null,
      notas: row.notas,
      caras: caras.map((c) => ({
        cara: c.cara,
        estado: c.estado,
      })),
    });
  }
  return { denticion, dientes };
}

async function persistDiente(
  tx: DbTransaction,
  clinicaId: string,
  odontogramaId: string,
  diente: DienteState | null,
  piezaFdi: number,
): Promise<void> {
  const existing = await tx
    .select({ id: odontogramaDientes.id })
    .from(odontogramaDientes)
    .where(
      and(
        eq(odontogramaDientes.odontogramaId, odontogramaId),
        eq(odontogramaDientes.piezaFdi, piezaFdi),
      ),
    )
    .limit(1);

  if (!diente) {
    if (existing[0]) {
      await tx
        .delete(odontogramaCaras)
        .where(eq(odontogramaCaras.dienteId, existing[0].id));
      await tx
        .delete(odontogramaDientes)
        .where(eq(odontogramaDientes.id, existing[0].id));
    }
    return;
  }

  const flags = syncFlagsFromEstado(diente.estadoPieza);
  let dienteId = existing[0]?.id;
  if (!dienteId) {
    dienteId = newId("odi");
    await tx.insert(odontogramaDientes).values({
      id: dienteId,
      odontogramaId,
      clinicaId,
      piezaFdi,
      estadoPieza: diente.estadoPieza,
      ...flags,
      movilidad: diente.movilidad,
      recesion: diente.recesion,
      notas: diente.notas,
    });
  } else {
    await tx
      .update(odontogramaDientes)
      .set({
        estadoPieza: diente.estadoPieza,
        ...flags,
        movilidad: diente.movilidad,
        recesion: diente.recesion,
        notas: diente.notas,
      })
      .where(eq(odontogramaDientes.id, dienteId));
    await tx
      .delete(odontogramaCaras)
      .where(eq(odontogramaCaras.dienteId, dienteId));
  }

  for (const cara of diente.caras) {
    await tx.insert(odontogramaCaras).values({
      id: newId("oca"),
      dienteId,
      clinicaId,
      cara: cara.cara,
      estado: cara.estado,
    });
  }
}

export async function loadOdontogramaEditor(
  clinicaId: string,
  pacienteId: string,
): Promise<ActionResult<OdontogramaEditorPayload>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "odontograma_read");

  try {
    const data = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const pac = await tx
          .select()
          .from(pacientes)
          .where(eq(pacientes.id, pacienteId))
          .limit(1);
        const paciente = pac[0];
        if (!paciente) throw new Error("Paciente no encontrado");

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

        const sugerida = sugerirDenticionPorEdad(
          ageYears(paciente.fechaNacimiento),
        );

        let draft = await tx
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
          const visitaId = newId("vis");
          await tx.insert(visitas).values({
            id: visitaId,
            clinicaId: ctx.clinicaId,
            pacienteId,
            profesionalMembresiaId: ctx.memberId,
            estado: "borrador",
            denticionForzada: sugerida,
          });
          draft = await tx
            .select()
            .from(visitas)
            .where(eq(visitas.id, visitaId))
            .limit(1);
        }

        const visita = draft[0]!;
        const denticion = (visita.denticionForzada ?? sugerida) as Denticion;

        let odo = await tx
          .select()
          .from(odontogramas)
          .where(eq(odontogramas.visitaId, visita.id))
          .limit(1);

        if (!odo[0]) {
          const odontogramaId = newId("odo");
          await tx.insert(odontogramas).values({
            id: odontogramaId,
            clinicaId: ctx.clinicaId,
            visitaId: visita.id,
            denticion,
            capturadoPor: ctx.userId,
            responsableId: ctx.role === "odontologo" ? ctx.memberId : null,
            inmutable: false,
          });
          odo = await tx
            .select()
            .from(odontogramas)
            .where(eq(odontogramas.id, odontogramaId))
            .limit(1);
        }

        const odontograma = odo[0]!;
        const snapshot = await loadSnapshotForOdontograma(
          tx,
          odontograma.id,
          odontograma.denticion as Denticion,
        );

        const prevVisita = await tx
          .select({ id: visitas.id })
          .from(visitas)
          .where(
            and(
              eq(visitas.pacienteId, pacienteId),
              ne(visitas.id, visita.id),
            ),
          )
          .orderBy(desc(visitas.createdAt))
          .limit(1);

        let reference: OdontogramaSnapshot | null = null;
        let referenceVisitaId: string | null = null;
        if (prevVisita[0]) {
          const prevOdo = await tx
            .select()
            .from(odontogramas)
            .where(eq(odontogramas.visitaId, prevVisita[0].id))
            .limit(1);
          if (prevOdo[0]) {
            referenceVisitaId = prevVisita[0].id;
            reference = await loadSnapshotForOdontograma(
              tx,
              prevOdo[0].id,
              prevOdo[0].denticion as Denticion,
            );
          }
        }

        const tramosRaw = await tx
          .select()
          .from(odontogramaProtesis)
          .where(eq(odontogramaProtesis.odontogramaId, odontograma.id));

        const tramos: TramoRow[] = tramosRaw.map((t) => ({
          id: t.id,
          tipo: t.tipo,
          piezasOrdenadas:
            t.piezasOrdenadas?.length > 0
              ? t.piezasOrdenadas
              : [t.piezaDesde, t.piezaHasta],
          estado: t.estado,
        }));

        return {
          pacienteId,
          visitaId: visita.id,
          odontogramaId: odontograma.id,
          denticion: odontograma.denticion as Denticion,
          denticionSugerida: sugerida,
          inmutable: odontograma.inmutable,
          snapshot,
          reference,
          referenceVisitaId,
          tramos,
          capturadoPor: odontograma.capturadoPor,
          responsableId: odontograma.responsableId,
        } satisfies OdontogramaEditorPayload;
      },
    );
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cargar odontograma",
    };
  }
}

export async function setDenticionAction(
  clinicaId: string,
  odontogramaId: string,
  denticion: Denticion,
): Promise<ActionResult<{ denticion: Denticion }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "odontograma_write");

  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(odontogramas)
          .where(eq(odontogramas.id, odontogramaId))
          .limit(1);
        const odo = rows[0];
        if (!odo) throw new Error("Odontograma no encontrado");
        if (odo.inmutable) throw new Error("Odontograma inmutable");

        await tx
          .update(odontogramas)
          .set({ denticion, capturadoPor: ctx.userId })
          .where(eq(odontogramas.id, odontogramaId));
        await tx
          .update(visitas)
          .set({ denticionForzada: denticion, updatedAt: new Date() })
          .where(eq(visitas.id, odo.visitaId));
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "set_denticion",
          entidad: "odontogramas",
          entidadId: odontogramaId,
          valorNuevo: { denticion },
        });
      },
    );
    return { ok: true, data: { denticion } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cambiar dentición",
    };
  }
}

export async function applyOdontogramaTransitionAction(
  clinicaId: string,
  odontogramaId: string,
  transition: Transition,
): Promise<ActionResult<{ snapshot: OdontogramaSnapshot }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "odontograma_write");

  try {
    const snapshot = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(odontogramas)
          .where(eq(odontogramas.id, odontogramaId))
          .limit(1);
        const odo = rows[0];
        if (!odo) throw new Error("Odontograma no encontrado");

        const visita = await tx
          .select({ estado: visitas.estado })
          .from(visitas)
          .where(eq(visitas.id, odo.visitaId))
          .limit(1);
        const locked = odo.inmutable || visita[0]?.estado === "firmada";

        const current = await loadSnapshotForOdontograma(
          tx,
          odo.id,
          odo.denticion as Denticion,
        );

        let reference: OdontogramaSnapshot | null = null;
        if (transition.type === "promote_from_reference") {
          const pacId = (
            await tx
              .select({ pacienteId: visitas.pacienteId })
              .from(visitas)
              .where(eq(visitas.id, odo.visitaId))
              .limit(1)
          )[0]?.pacienteId;
          if (pacId) {
            const prev = await tx
              .select({ id: visitas.id })
              .from(visitas)
              .where(
                and(eq(visitas.pacienteId, pacId), ne(visitas.id, odo.visitaId)),
              )
              .orderBy(desc(visitas.createdAt))
              .limit(1);
            if (prev[0]) {
              const prevOdo = await tx
                .select()
                .from(odontogramas)
                .where(eq(odontogramas.visitaId, prev[0].id))
                .limit(1);
              if (prevOdo[0]) {
                reference = await loadSnapshotForOdontograma(
                  tx,
                  prevOdo[0].id,
                  prevOdo[0].denticion as Denticion,
                );
              }
            }
          }
        }

        const applied = applyTransition(current, transition, {
          immutable: locked,
          reference,
        });

        const piezaFdi =
          "piezaFdi" in transition ? transition.piezaFdi : undefined;
        if (piezaFdi != null) {
          const nextDiente =
            applied.after.dientes.find((d) => d.piezaFdi === piezaFdi) ?? null;
          await persistDiente(
            tx,
            ctx.clinicaId,
            odontogramaId,
            nextDiente,
            piezaFdi,
          );
        }

        await tx
          .update(odontogramas)
          .set({ capturadoPor: ctx.userId })
          .where(eq(odontogramas.id, odontogramaId));

        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: transition.type,
          entidad: "odontogramas",
          entidadId: odontogramaId,
          valorNuevo: transition,
        });

        return applied.after;
      },
    );
    return { ok: true, data: { snapshot } };
  } catch (err) {
    if (err instanceof OdontogramaValidationError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al aplicar cambio",
    };
  }
}

export async function undoOdontogramaSnapshotAction(
  clinicaId: string,
  odontogramaId: string,
  before: OdontogramaSnapshot,
  piezaFdi: number,
): Promise<ActionResult<{ snapshot: OdontogramaSnapshot }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "odontograma_write");

  try {
    const snapshot = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(odontogramas)
          .where(eq(odontogramas.id, odontogramaId))
          .limit(1);
        const odo = rows[0];
        if (!odo) throw new Error("Odontograma no encontrado");
        if (odo.inmutable) throw new Error("Odontograma inmutable");

        const diente =
          before.dientes.find((d) => d.piezaFdi === piezaFdi) ?? null;
        await persistDiente(
          tx,
          ctx.clinicaId,
          odontogramaId,
          diente ? { ...emptyDiente(piezaFdi), ...diente } : null,
          piezaFdi,
        );
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "undo",
          entidad: "odontogramas",
          entidadId: odontogramaId,
          valorNuevo: { piezaFdi },
        });
        return loadSnapshotForOdontograma(
          tx,
          odontogramaId,
          odo.denticion as Denticion,
        );
      },
    );
    return { ok: true, data: { snapshot } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al deshacer",
    };
  }
}

export async function addTramoAction(
  clinicaId: string,
  odontogramaId: string,
  input: {
    tipo: "fija" | "removible" | "total";
    piezasOrdenadas: number[];
    estado?: string;
  },
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "odontograma_write");

  if (!arePiezasContiguasMismoArco(input.piezasOrdenadas)) {
    return {
      ok: false,
      error: "Las piezas del tramo deben ser contiguas en el mismo arco",
    };
  }

  try {
    const id = newId("otr");
    const sorted = [...input.piezasOrdenadas].sort((a, b) => a - b);
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(odontogramas)
          .where(eq(odontogramas.id, odontogramaId))
          .limit(1);
        if (!rows[0] || rows[0].inmutable) {
          throw new Error("Odontograma no editable");
        }
        await tx.insert(odontogramaProtesis).values({
          id,
          odontogramaId,
          clinicaId: ctx.clinicaId,
          tipo: input.tipo,
          piezasOrdenadas: sorted,
          piezaDesde: sorted[0]!,
          piezaHasta: sorted[sorted.length - 1]!,
          estado: input.estado ?? null,
        });
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "add_tramo",
          entidad: "odontograma_protesis",
          entidadId: id,
          valorNuevo: input,
        });
      },
    );
    revalidatePath(`/app/${clinicaId}`);
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear tramo",
    };
  }
}

export async function deleteTramoAction(
  clinicaId: string,
  tramoId: string,
): Promise<ActionResult> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "odontograma_write");
  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        await tx
          .delete(odontogramaProtesis)
          .where(eq(odontogramaProtesis.id, tramoId));
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "delete_tramo",
          entidad: "odontograma_protesis",
          entidadId: tramoId,
        });
      },
    );
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar tramo",
    };
  }
}

// re-export types used by client
export type { Transition, EstadoPieza, EstadoCara, CaraDental, Denticion };
