import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db/client";
import {
  anamnesis,
  consentimientos,
  diagnosticos,
  documentosGenerados,
  indicadoresSaludBucal,
  indices,
  odontogramaCaras,
  odontogramaDientes,
  odontogramaProtesis,
  odontogramas,
  pacientes,
  planItems,
  planTratamiento,
  prescripciones,
  sesionesDictado,
  visitaAdendas,
  visitas,
} from "@/lib/db/schema";
import { anonymizedPacienteFields } from "@/lib/clinical/arco";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";

/** Enable immutability bypass for this transaction only. */
export async function enableArcoPurge(tx: DbTransaction): Promise<void> {
  await tx.execute(sql`SELECT set_config('app.arco_purge', 'true', true)`);
}

/**
 * Delete clinical rows for a patient and anonymize the patient stub.
 * Must run inside withTenant after enableArcoPurge when firmadas exist.
 */
export async function purgePacienteClinico(
  tx: DbTransaction,
  input: { clinicaId: string; pacienteId: string; solicitudId: string },
): Promise<{ visitasEliminadas: number; docsRutas: string[] }> {
  const visitaRows = await tx
    .select({ id: visitas.id })
    .from(visitas)
    .where(
      and(
        eq(visitas.pacienteId, input.pacienteId),
        eq(visitas.clinicaId, input.clinicaId),
      ),
    );
  const visitaIds = visitaRows.map((v) => v.id);

  const docRows =
    visitaIds.length === 0
      ? []
      : await tx
          .select({ ruta: documentosGenerados.rutaStorage })
          .from(documentosGenerados)
          .where(inArray(documentosGenerados.visitaId, visitaIds));
  const docsRutas = docRows.map((d) => d.ruta);

  if (visitaIds.length > 0) {
    const odoRows = await tx
      .select({ id: odontogramas.id })
      .from(odontogramas)
      .where(inArray(odontogramas.visitaId, visitaIds));
    const odoIds = odoRows.map((o) => o.id);

    if (odoIds.length > 0) {
      const dienteRows = await tx
        .select({ id: odontogramaDientes.id })
        .from(odontogramaDientes)
        .where(inArray(odontogramaDientes.odontogramaId, odoIds));
      const dienteIds = dienteRows.map((d) => d.id);
      if (dienteIds.length > 0) {
        await tx
          .delete(odontogramaCaras)
          .where(inArray(odontogramaCaras.dienteId, dienteIds));
      }
      await tx
        .delete(odontogramaDientes)
        .where(inArray(odontogramaDientes.odontogramaId, odoIds));
      await tx
        .delete(odontogramaProtesis)
        .where(inArray(odontogramaProtesis.odontogramaId, odoIds));
      await tx.delete(odontogramas).where(inArray(odontogramas.id, odoIds));
    }

    const planRows = await tx
      .select({ id: planTratamiento.id })
      .from(planTratamiento)
      .where(inArray(planTratamiento.visitaId, visitaIds));
    const planIds = planRows.map((p) => p.id);
    if (planIds.length > 0) {
      await tx.delete(planItems).where(inArray(planItems.planId, planIds));
      await tx.delete(planTratamiento).where(inArray(planTratamiento.id, planIds));
    }

    await tx
      .delete(indicadoresSaludBucal)
      .where(inArray(indicadoresSaludBucal.visitaId, visitaIds));
    await tx.delete(indices).where(inArray(indices.visitaId, visitaIds));
    await tx
      .delete(diagnosticos)
      .where(inArray(diagnosticos.visitaId, visitaIds));
    await tx
      .delete(documentosGenerados)
      .where(inArray(documentosGenerados.visitaId, visitaIds));
    await tx
      .delete(sesionesDictado)
      .where(inArray(sesionesDictado.visitaId, visitaIds));
    await tx
      .delete(prescripciones)
      .where(inArray(prescripciones.visitaId, visitaIds));
    await tx
      .delete(visitaAdendas)
      .where(inArray(visitaAdendas.visitaId, visitaIds));
    await tx.delete(visitas).where(inArray(visitas.id, visitaIds));
  }

  await tx
    .delete(anamnesis)
    .where(
      and(
        eq(anamnesis.pacienteId, input.pacienteId),
        eq(anamnesis.clinicaId, input.clinicaId),
      ),
    );
  await tx
    .delete(consentimientos)
    .where(
      and(
        eq(consentimientos.pacienteId, input.pacienteId),
        eq(consentimientos.clinicaId, input.clinicaId),
      ),
    );

  const anon = anonymizedPacienteFields(input.solicitudId);
  await tx
    .update(pacientes)
    .set({
      ...anon,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pacientes.id, input.pacienteId),
        eq(pacientes.clinicaId, input.clinicaId),
      ),
    );

  return { visitasEliminadas: visitaIds.length, docsRutas };
}

/** Best-effort unlink of PDF files after DB commit (paths relative to storage/documentos). */
export async function unlinkDocumentFiles(rutas: string[]): Promise<void> {
  const root = resolve(process.cwd(), "storage", "documentos");
  for (const ruta of rutas) {
    const normalized = ruta.replace(/\\/g, "/");
    if (normalized.includes("..")) continue;
    try {
      await unlink(resolve(root, ...normalized.split("/")));
    } catch {
      /* missing file is fine */
    }
  }
}
