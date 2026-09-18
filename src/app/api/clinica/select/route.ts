import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { assertActiveMembership } from "@/lib/db/with-tenant";
import { dbMigrator } from "@/lib/db/client";
import { session as sessionTable } from "@/lib/db/schema";

/**
 * Persists activeOrganizationId as a UI hint only.
 * Authorization always re-checks active membership server-side.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || !session.session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { clinicaId?: string };
  if (!body.clinicaId) {
    return NextResponse.json({ error: "clinicaId_required" }, { status: 400 });
  }

  try {
    const membership = await assertActiveMembership(
      session.user.id,
      body.clinicaId,
    );

    await dbMigrator
      .update(sessionTable)
      .set({ activeOrganizationId: body.clinicaId, updatedAt: new Date() })
      .where(eq(sessionTable.id, session.session.id));

    return NextResponse.json({
      ok: true,
      role: membership.role,
      memberId: membership.memberId,
    });
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
}
