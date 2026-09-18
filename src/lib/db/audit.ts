import type { DbTransaction } from "@/lib/db/client";
import { auditLog } from "@/lib/db/schema";
import { newId } from "@/lib/ids";

export type AuditWrite = {
  clinicaId: string;
  actorUserId: string;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  valorAnterior?: unknown;
  valorNuevo?: unknown;
  ip?: string | null;
  userAgent?: string | null;
};

/** Append-only audit row; must run inside withTenant transaction. */
export async function writeAudit(
  tx: DbTransaction,
  entry: AuditWrite,
): Promise<void> {
  await tx.insert(auditLog).values({
    id: newId("aud"),
    clinicaId: entry.clinicaId,
    actorUserId: entry.actorUserId,
    accion: entry.accion,
    entidad: entry.entidad,
    entidadId: entry.entidadId ?? null,
    valorAnterior: entry.valorAnterior ?? null,
    valorNuevo: entry.valorNuevo ?? null,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
  });
}
