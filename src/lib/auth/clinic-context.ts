import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { dbMigrator } from "@/lib/db/client";
import { member, organization } from "@/lib/db/schema";
import {
  assertCan,
  can,
  isClinicRole,
  type ClinicalCapability,
  type ClinicRole,
} from "@/lib/clinical/permissions";

export type ClinicContext = {
  userId: string;
  userName: string;
  clinicaId: string;
  clinicaName: string;
  role: ClinicRole;
  memberId: string;
  inactividadMinutos: number;
};

/**
 * Resolve session + active membership for a clinica.
 * Role always comes from member row, never from a client claim.
 */
export async function requireClinicContext(
  clinicaId: string,
): Promise<ClinicContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const rows = await dbMigrator
    .select({
      memberId: member.id,
      role: member.role,
      estado: member.estado,
      name: organization.name,
      inactividadMinutos: organization.inactividadMinutos,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(
      and(
        eq(member.userId, session.user.id),
        eq(member.organizationId, clinicaId),
        eq(member.estado, "activa"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || !isClinicRole(row.role)) notFound();

  return {
    userId: session.user.id,
    userName: session.user.name,
    clinicaId,
    clinicaName: row.name,
    role: row.role,
    memberId: row.memberId,
    inactividadMinutos: row.inactividadMinutos,
  };
}

export function requireCapability(
  ctx: ClinicContext,
  capability: ClinicalCapability,
): void {
  assertCan(ctx.role, capability);
}

export function hasCapability(
  ctx: ClinicContext,
  capability: ClinicalCapability,
): boolean {
  return can(ctx.role, capability);
}
