import type { Transition } from "@/lib/clinical/odontograma";
import { getOfflineDb, type OfflineMutation } from "@/lib/offline/db";
import { draftKey } from "@/lib/offline/network";

export async function enqueueOdontogramaTransition(input: {
  clinicaId: string;
  pacienteId: string;
  odontogramaId: string;
  transition: Transition;
}): Promise<number> {
  const db = getOfflineDb();
  const id = await db.mutations.add({
    clinicaId: input.clinicaId,
    pacienteId: input.pacienteId,
    odontogramaId: input.odontogramaId,
    kind: "odontograma_transition",
    payload: input.transition,
    createdAt: new Date().toISOString(),
    status: "pending",
  });
  await db.drafts.put({
    key: draftKey(input.clinicaId, input.odontogramaId),
    clinicaId: input.clinicaId,
    pacienteId: input.pacienteId,
    odontogramaId: input.odontogramaId,
    updatedAt: new Date().toISOString(),
    note: "Cambios locales pendientes de sincronizar",
  });
  return id as number;
}

export async function listPendingMutations(
  clinicaId?: string,
): Promise<OfflineMutation[]> {
  const db = getOfflineDb();
  if (clinicaId) {
    return db.mutations
      .where("clinicaId")
      .equals(clinicaId)
      .filter((m) => m.status === "pending" || m.status === "failed")
      .sortBy("createdAt");
  }
  return db.mutations
    .filter((m) => m.status === "pending" || m.status === "failed")
    .sortBy("createdAt");
}

export async function countPendingMutations(clinicaId?: string): Promise<number> {
  const rows = await listPendingMutations(clinicaId);
  return rows.length;
}

export async function removeMutation(id: number): Promise<void> {
  await getOfflineDb().mutations.delete(id);
}

export async function markMutationFailed(
  id: number,
  lastError: string,
): Promise<void> {
  await getOfflineDb().mutations.update(id, {
    status: "failed",
    lastError,
  });
}

export async function clearDraftIfEmpty(
  clinicaId: string,
  odontogramaId: string,
): Promise<void> {
  const db = getOfflineDb();
  const remaining = await db.mutations
    .where("clinicaId")
    .equals(clinicaId)
    .filter(
      (m) =>
        m.odontogramaId === odontogramaId &&
        (m.status === "pending" || m.status === "failed"),
    )
    .count();
  if (remaining === 0) {
    await db.drafts.delete(draftKey(clinicaId, odontogramaId));
  }
}
