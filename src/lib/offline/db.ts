import Dexie, { type EntityTable } from "dexie";
import type { Transition } from "@/lib/clinical/odontograma";

export type OfflineMutationKind = "odontograma_transition";

export type OfflineMutation = {
  id?: number;
  clinicaId: string;
  pacienteId: string;
  odontogramaId: string;
  kind: OfflineMutationKind;
  /** Serialized Transition for odontograma_transition */
  payload: Transition;
  createdAt: string;
  status: "pending" | "failed";
  lastError?: string;
};

export type OfflineDraft = {
  /** `${clinicaId}:${odontogramaId}` */
  key: string;
  clinicaId: string;
  pacienteId: string;
  odontogramaId: string;
  updatedAt: string;
  note: string;
};

class ClinicaOfflineDb extends Dexie {
  mutations!: EntityTable<OfflineMutation, "id">;
  drafts!: EntityTable<OfflineDraft, "key">;

  constructor() {
    super("clinica_odontologica_offline");
    this.version(1).stores({
      mutations: "++id, clinicaId, pacienteId, status, createdAt",
      drafts: "key, clinicaId, odontogramaId",
    });
  }
}

/** Browser-only Dexie instance (lazy). */
let _db: ClinicaOfflineDb | null = null;

export function getOfflineDb(): ClinicaOfflineDb {
  if (typeof window === "undefined") {
    throw new Error("Dexie offline DB is browser-only");
  }
  if (!_db) _db = new ClinicaOfflineDb();
  return _db;
}
