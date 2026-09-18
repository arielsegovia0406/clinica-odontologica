"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import {
  hasCapability,
  requireCapability,
  requireClinicContext,
} from "@/lib/auth/clinic-context";
import {
  canExecuteEliminacion,
  canExecuteExportacion,
  nextEstadoTrasAprobar,
  nextEstadoTrasRechazar,
} from "@/lib/clinical/arco";
import type { ArcoExportPackage } from "@/lib/arco/export-shape";
import { toExportValue } from "@/lib/arco/export-shape";
import { saveArcoExportJson } from "@/lib/arco/storage";
import {
  enableArcoPurge,
  purgePacienteClinico,
  unlinkDocumentFiles,
} from "@/lib/arco/purge";
import { writeAudit } from "@/lib/db/audit";
import {
  anamnesis,
  consentimientos,
  diagnosticos,
  documentosGenerados,
  indices,
  odontogramaCaras,
  odontogramaDientes,
  odontogramaProtesis,
  odontogramas,
  pacientes,
  sesionesDictado,
  solicitudesArco,
  visitas,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/with-tenant";
import { newId } from "@/lib/ids";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type SolicitudArcoItem = {
  id: string;
  pacienteId: string;
  pacienteLabel: string;
  tipo: "exportacion" | "eliminacion";
  estado: "solicitada" | "aprobada_admin" | "rechazada" | "ejecutada";
  solicitadoEn: Date;
  ejecutadoEn: Date | null;
  nota: string | null;
  resultadoRuta: string | null;
  resultadoHash: string | null;
  retencionHasta: Date | null;
};

export async function listSolicitudesPacienteAction(
  clinicaId: string,
  pacienteId: string,
): Promise<ActionResult<{ solicitudes: SolicitudArcoItem[] }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "paciente_read");

  try {
    const data = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const pac = await tx
          .select({
            id: pacientes.id,
            nombres: pacientes.nombres,
            apellidos: pacientes.apellidos,
            retencionHasta: pacientes.retencionHasta,
          })
          .from(pacientes)
          .where(
            and(
              eq(pacientes.id, pacienteId),
              eq(pacientes.clinicaId, clinicaId),
            ),
          )
          .limit(1);
        const p = pac[0];
        if (!p) throw new Error("Paciente no encontrado");

        const rows = await tx
          .select()
          .from(solicitudesArco)
          .where(
            and(
              eq(solicitudesArco.pacienteId, pacienteId),
              eq(solicitudesArco.clinicaId, clinicaId),
            ),
          )
          .orderBy(desc(solicitudesArco.solicitadoEn));

        return {
          solicitudes: rows.map((r) => ({
            id: r.id,
            pacienteId: r.pacienteId,
            pacienteLabel: `${p.apellidos}, ${p.nombres}`,
            tipo: r.tipo,
            estado: r.estado,
            solicitadoEn: r.solicitadoEn,
            ejecutadoEn: r.ejecutadoEn,
            nota: r.nota,
            resultadoRuta: r.resultadoRuta,
            resultadoHash: r.resultadoHash,
            retencionHasta: p.retencionHasta,
          })),
        };
      },
    );
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al listar ARCO",
    };
  }
}

export async function listSolicitudesClinicaAction(
  clinicaId: string,
): Promise<ActionResult<{ solicitudes: SolicitudArcoItem[] }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "arco_admin");

  try {
    const data = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select({
            id: solicitudesArco.id,
            pacienteId: solicitudesArco.pacienteId,
            tipo: solicitudesArco.tipo,
            estado: solicitudesArco.estado,
            solicitadoEn: solicitudesArco.solicitadoEn,
            ejecutadoEn: solicitudesArco.ejecutadoEn,
            nota: solicitudesArco.nota,
            resultadoRuta: solicitudesArco.resultadoRuta,
            resultadoHash: solicitudesArco.resultadoHash,
            nombres: pacientes.nombres,
            apellidos: pacientes.apellidos,
            retencionHasta: pacientes.retencionHasta,
          })
          .from(solicitudesArco)
          .innerJoin(pacientes, eq(pacientes.id, solicitudesArco.pacienteId))
          .where(eq(solicitudesArco.clinicaId, clinicaId))
          .orderBy(desc(solicitudesArco.solicitadoEn));

        return {
          solicitudes: rows.map((r) => ({
            id: r.id,
            pacienteId: r.pacienteId,
            pacienteLabel: `${r.apellidos}, ${r.nombres}`,
            tipo: r.tipo,
            estado: r.estado,
            solicitadoEn: r.solicitadoEn,
            ejecutadoEn: r.ejecutadoEn,
            nota: r.nota,
            resultadoRuta: r.resultadoRuta,
            resultadoHash: r.resultadoHash,
            retencionHasta: r.retencionHasta,
          })),
        };
      },
    );
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al listar ARCO",
    };
  }
}

export async function crearSolicitudArcoAction(
  clinicaId: string,
  pacienteId: string,
  tipo: "exportacion" | "eliminacion",
  nota?: string,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  if (!hasCapability(ctx, "arco_solicitar")) {
    return { ok: false, error: `Forbidden: role ${ctx.role} cannot arco_solicitar` };
  }
  if (tipo !== "exportacion" && tipo !== "eliminacion") {
    return { ok: false, error: "Tipo de solicitud inválido" };
  }

  try {
    const id = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const pac = await tx
          .select({ id: pacientes.id })
          .from(pacientes)
          .where(
            and(
              eq(pacientes.id, pacienteId),
              eq(pacientes.clinicaId, clinicaId),
            ),
          )
          .limit(1);
        if (!pac[0]) throw new Error("Paciente no encontrado");

        const solicitudId = newId("arco");
        await tx.insert(solicitudesArco).values({
          id: solicitudId,
          clinicaId,
          pacienteId,
          tipo,
          estado: "solicitada",
          nota: nota?.trim() || null,
        });
        await writeAudit(tx, {
          clinicaId,
          actorUserId: ctx.userId,
          accion: "arco.solicitar",
          entidad: "solicitudes_arco",
          entidadId: solicitudId,
          valorNuevo: { tipo, pacienteId },
        });
        return solicitudId;
      },
    );
    return { ok: true, data: { id } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al crear solicitud",
    };
  }
}

export async function aprobarSolicitudArcoAction(
  clinicaId: string,
  solicitudId: string,
): Promise<ActionResult> {
  const ctx = await requireClinicContext(clinicaId);
  if (!hasCapability(ctx, "arco_admin")) {
    return { ok: false, error: `Forbidden: role ${ctx.role} cannot arco_admin` };
  }

  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(solicitudesArco)
          .where(
            and(
              eq(solicitudesArco.id, solicitudId),
              eq(solicitudesArco.clinicaId, clinicaId),
            ),
          )
          .limit(1);
        const s = rows[0];
        if (!s) throw new Error("Solicitud no encontrada");
        const next = nextEstadoTrasAprobar(s.estado);
        if (!next) throw new Error(`No se puede aprobar desde estado ${s.estado}`);

        await tx
          .update(solicitudesArco)
          .set({ estado: next, aprobadoPor: ctx.userId })
          .where(eq(solicitudesArco.id, solicitudId));
        await writeAudit(tx, {
          clinicaId,
          actorUserId: ctx.userId,
          accion: "arco.aprobar",
          entidad: "solicitudes_arco",
          entidadId: solicitudId,
          valorAnterior: { estado: s.estado },
          valorNuevo: { estado: next },
        });
      },
    );
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al aprobar",
    };
  }
}

export async function rechazarSolicitudArcoAction(
  clinicaId: string,
  solicitudId: string,
  nota?: string,
): Promise<ActionResult> {
  const ctx = await requireClinicContext(clinicaId);
  if (!hasCapability(ctx, "arco_admin")) {
    return { ok: false, error: `Forbidden: role ${ctx.role} cannot arco_admin` };
  }

  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(solicitudesArco)
          .where(
            and(
              eq(solicitudesArco.id, solicitudId),
              eq(solicitudesArco.clinicaId, clinicaId),
            ),
          )
          .limit(1);
        const s = rows[0];
        if (!s) throw new Error("Solicitud no encontrada");
        const next = nextEstadoTrasRechazar(s.estado);
        if (!next) throw new Error(`No se puede rechazar desde estado ${s.estado}`);

        await tx
          .update(solicitudesArco)
          .set({
            estado: next,
            aprobadoPor: ctx.userId,
            nota: nota?.trim() || s.nota,
          })
          .where(eq(solicitudesArco.id, solicitudId));
        await writeAudit(tx, {
          clinicaId,
          actorUserId: ctx.userId,
          accion: "arco.rechazar",
          entidad: "solicitudes_arco",
          entidadId: solicitudId,
          valorAnterior: { estado: s.estado },
          valorNuevo: { estado: next },
        });
      },
    );
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al rechazar",
    };
  }
}

async function buildExportPackage(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  input: { clinicaId: string; pacienteId: string; solicitudId: string },
): Promise<ArcoExportPackage> {
  const pacRows = await tx
    .select()
    .from(pacientes)
    .where(
      and(
        eq(pacientes.id, input.pacienteId),
        eq(pacientes.clinicaId, input.clinicaId),
      ),
    )
    .limit(1);
  const paciente = pacRows[0];
  if (!paciente) throw new Error("Paciente no encontrado");

  const consents = await tx
    .select()
    .from(consentimientos)
    .where(eq(consentimientos.pacienteId, input.pacienteId));
  const ana = await tx
    .select()
    .from(anamnesis)
    .where(eq(anamnesis.pacienteId, input.pacienteId));
  const vis = await tx
    .select()
    .from(visitas)
    .where(eq(visitas.pacienteId, input.pacienteId));
  const visitaIds = vis.map((v) => v.id);

  let odo: unknown[] = [];
  let idx: unknown[] = [];
  let diag: unknown[] = [];
  let docs: unknown[] = [];
  let dict: unknown[] = [];

  if (visitaIds.length > 0) {
    const odoRows = await tx
      .select()
      .from(odontogramas)
      .where(inArray(odontogramas.visitaId, visitaIds));
    const odoIds = odoRows.map((o) => o.id);
    const dientes =
      odoIds.length === 0
        ? []
        : await tx
            .select()
            .from(odontogramaDientes)
            .where(inArray(odontogramaDientes.odontogramaId, odoIds));
    const dienteIds = dientes.map((d) => d.id);
    const caras =
      dienteIds.length === 0
        ? []
        : await tx
            .select()
            .from(odontogramaCaras)
            .where(inArray(odontogramaCaras.dienteId, dienteIds));
    const protesis =
      odoIds.length === 0
        ? []
        : await tx
            .select()
            .from(odontogramaProtesis)
            .where(inArray(odontogramaProtesis.odontogramaId, odoIds));
    odo = odoRows.map((o) => ({
      ...o,
      dientes: dientes.filter((d) => d.odontogramaId === o.id).map((d) => ({
        ...d,
        caras: caras.filter((c) => c.dienteId === d.id),
      })),
      protesis: protesis.filter((p) => p.odontogramaId === o.id),
    }));
    idx = await tx.select().from(indices).where(inArray(indices.visitaId, visitaIds));
    diag = await tx
      .select()
      .from(diagnosticos)
      .where(inArray(diagnosticos.visitaId, visitaIds));
    docs = await tx
      .select({
        id: documentosGenerados.id,
        tipo: documentosGenerados.tipo,
        generadoEn: documentosGenerados.generadoEn,
        contentHash: documentosGenerados.contentHash,
        rutaStorage: documentosGenerados.rutaStorage,
      })
      .from(documentosGenerados)
      .where(inArray(documentosGenerados.visitaId, visitaIds));
    dict = await tx
      .select({
        id: sesionesDictado.id,
        visitaId: sesionesDictado.visitaId,
        createdAt: sesionesDictado.createdAt,
        transcripcion: sesionesDictado.transcripcion,
        camposAceptadosCorregidos: sesionesDictado.camposAceptadosCorregidos,
        audioRetenido: sesionesDictado.audioRetenido,
      })
      .from(sesionesDictado)
      .where(inArray(sesionesDictado.visitaId, visitaIds));
  }

  const arcs = await tx
    .select()
    .from(solicitudesArco)
    .where(eq(solicitudesArco.pacienteId, input.pacienteId));

  return toExportValue({
    schemaVersion: 1,
    generadoEn: new Date().toISOString(),
    clinicaId: input.clinicaId,
    solicitudId: input.solicitudId,
    paciente,
    consentimientos: consents,
    anamnesis: ana,
    visitas: vis,
    odontogramas: odo,
    indices: idx,
    diagnosticos: diag,
    documentosGenerados: docs,
    sesionesDictado: dict,
    solicitudesArco: arcs,
  }) as ArcoExportPackage;
}

export async function ejecutarExportacionArcoAction(
  clinicaId: string,
  solicitudId: string,
): Promise<ActionResult<{ resultadoRuta: string; contentHash: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  if (!hasCapability(ctx, "arco_admin")) {
    return { ok: false, error: `Forbidden: role ${ctx.role} cannot arco_admin` };
  }

  try {
    const result = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select()
          .from(solicitudesArco)
          .where(
            and(
              eq(solicitudesArco.id, solicitudId),
              eq(solicitudesArco.clinicaId, clinicaId),
            ),
          )
          .limit(1);
        const s = rows[0];
        if (!s) throw new Error("Solicitud no encontrada");
        const gate = canExecuteExportacion({
          estado: s.estado,
          tipo: s.tipo,
        });
        if (gate.ok === false) throw new Error(gate.reason);

        const pkg = await buildExportPackage(tx, {
          clinicaId,
          pacienteId: s.pacienteId,
          solicitudId,
        });
        const saved = await saveArcoExportJson({
          clinicaId,
          solicitudId,
          payload: pkg,
        });

        await tx
          .update(solicitudesArco)
          .set({
            estado: "ejecutada",
            ejecutadoEn: new Date(),
            resultadoRuta: saved.rutaStorage,
            resultadoHash: saved.contentHash,
          })
          .where(eq(solicitudesArco.id, solicitudId));

        await writeAudit(tx, {
          clinicaId,
          actorUserId: ctx.userId,
          accion: "arco.ejecutar_exportacion",
          entidad: "solicitudes_arco",
          entidadId: solicitudId,
          valorNuevo: {
            resultadoHash: saved.contentHash,
            resultadoRuta: saved.rutaStorage,
          },
        });

        return {
          resultadoRuta: saved.rutaStorage,
          contentHash: saved.contentHash,
        };
      },
    );
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al exportar",
    };
  }
}

export async function ejecutarEliminacionArcoAction(
  clinicaId: string,
  solicitudId: string,
): Promise<ActionResult<{ visitasEliminadas: number }>> {
  const ctx = await requireClinicContext(clinicaId);
  if (!hasCapability(ctx, "arco_admin")) {
    return { ok: false, error: `Forbidden: role ${ctx.role} cannot arco_admin` };
  }

  try {
    let docsRutas: string[] = [];
    const result = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const rows = await tx
          .select({
            solicitud: solicitudesArco,
            retencionHasta: pacientes.retencionHasta,
          })
          .from(solicitudesArco)
          .innerJoin(pacientes, eq(pacientes.id, solicitudesArco.pacienteId))
          .where(
            and(
              eq(solicitudesArco.id, solicitudId),
              eq(solicitudesArco.clinicaId, clinicaId),
            ),
          )
          .limit(1);
        const row = rows[0];
        if (!row) throw new Error("Solicitud no encontrada");
        const s = row.solicitud;
        const gate = canExecuteEliminacion({
          estado: s.estado,
          tipo: s.tipo,
          retencionHasta: row.retencionHasta,
        });
        if (gate.ok === false) throw new Error(gate.reason);

        await enableArcoPurge(tx);
        const purged = await purgePacienteClinico(tx, {
          clinicaId,
          pacienteId: s.pacienteId,
          solicitudId,
        });
        docsRutas = purged.docsRutas;

        await tx
          .update(solicitudesArco)
          .set({
            estado: "ejecutada",
            ejecutadoEn: new Date(),
          })
          .where(eq(solicitudesArco.id, solicitudId));

        await writeAudit(tx, {
          clinicaId,
          actorUserId: ctx.userId,
          accion: "arco.ejecutar_eliminacion",
          entidad: "solicitudes_arco",
          entidadId: solicitudId,
          valorNuevo: {
            pacienteId: s.pacienteId,
            visitasEliminadas: purged.visitasEliminadas,
          },
        });

        return { visitasEliminadas: purged.visitasEliminadas };
      },
    );
    await unlinkDocumentFiles(docsRutas);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar",
    };
  }
}
