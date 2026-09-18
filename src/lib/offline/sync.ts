"use client";

import { applyOdontogramaTransitionAction } from "@/app/app/[clinicaId]/pacientes/[pacienteId]/odontograma/actions";
import {
  clearDraftIfEmpty,
  listPendingMutations,
  markMutationFailed,
  removeMutation,
} from "@/lib/offline/queue";

export type SyncResult = {
  synced: number;
  failed: number;
  errors: string[];
};

/** Flush pending Dexie mutations in FIFO order for a clinic. */
export async function flushOfflineQueue(clinicaId: string): Promise<SyncResult> {
  const pending = await listPendingMutations(clinicaId);
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const m of pending) {
    if (!m.id) continue;
    try {
      if (m.kind === "odontograma_transition") {
        const result = await applyOdontogramaTransitionAction(
          m.clinicaId,
          m.odontogramaId,
          m.payload,
        );
        if (result.ok === false) {
          await markMutationFailed(m.id, result.error);
          failed += 1;
          errors.push(result.error);
          continue;
        }
        await removeMutation(m.id);
        await clearDraftIfEmpty(m.clinicaId, m.odontogramaId);
        synced += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de sync";
      await markMutationFailed(m.id, msg);
      failed += 1;
      errors.push(msg);
    }
  }

  return { synced, failed, errors };
}
