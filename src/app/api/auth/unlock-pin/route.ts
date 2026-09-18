import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { dbMigrator } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { verifyPin } from "@/lib/auth/password";

/**
 * Unlock after inactivity lock. Does not create a new session —
 * clears client lock only after PIN verification. Drafts stay intact.
 */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { pin?: string };
  if (!body.pin) {
    return NextResponse.json({ error: "pin_required" }, { status: 400 });
  }

  const rows = await dbMigrator
    .select({ pinHash: user.pinHash })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  const pinHash = rows[0]?.pinHash;
  if (!pinHash) {
    return NextResponse.json({ error: "pin_not_set" }, { status: 400 });
  }

  const ok = await verifyPin(body.pin, pinHash);
  if (!ok) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
