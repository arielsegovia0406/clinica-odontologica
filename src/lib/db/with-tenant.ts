import { sql } from "drizzle-orm";
import { dbUnsafe, type DbTransaction } from "./client";
import { member } from "./schema";
import { and, eq } from "drizzle-orm";

export type { DbTransaction };

export type TenantContext = {
  clinicaId: string;
  userId: string;
  /** When true, skip membership check (tests / migrator tooling only) */
  skipMembershipCheck?: boolean;
};

/**
 * Sole entry point for tenant-scoped DB access.
 * Always opens an explicit transaction and SET LOCAL so poolers cannot leak clinic context.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  if (!ctx.clinicaId || !ctx.userId) {
    throw new Error("withTenant requires clinicaId and userId");
  }

  return dbUnsafe.transaction(async (tx) => {
    if (!ctx.skipMembershipCheck) {
      const rows = await tx
        .select({ id: member.id, estado: member.estado, role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, ctx.clinicaId),
            eq(member.userId, ctx.userId),
            eq(member.estado, "activa"),
          ),
        )
        .limit(1);

      if (rows.length === 0) {
        throw new Error("Forbidden: no active membership for clinica");
      }
    }

    // SET LOCAL dies with the transaction — never SET SESSION on pooled connections
    await tx.execute(
      sql`SELECT set_config('app.clinica_id', ${ctx.clinicaId}, true)`,
    );
    await tx.execute(
      sql`SELECT set_config('app.user_id', ${ctx.userId}, true)`,
    );

    return fn(tx);
  });
}

/**
 * Resolve and authorize clinic context from server-side membership only.
 * Client-supplied activeOrganizationId is a hint, never authorization.
 */
export async function assertActiveMembership(
  userId: string,
  clinicaId: string,
): Promise<{ role: string; memberId: string }> {
  return withTenant({ clinicaId, userId }, async (tx) => {
    const rows = await tx
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, clinicaId),
          eq(member.userId, userId),
          eq(member.estado, "activa"),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) {
      throw new Error("Forbidden");
    }
    return { role: row.role, memberId: row.id };
  });
}
