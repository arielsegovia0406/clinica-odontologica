import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { assertActiveMembership } from "@/lib/db/with-tenant";
import { withTenant } from "@/lib/db/with-tenant";
import { documentosGenerados } from "@/lib/db/schema";
import { readDocumentPdf } from "@/lib/documents/storage";
import { can } from "@/lib/clinical/permissions";

type Params = { params: Promise<{ clinicaId: string; documentoId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { clinicaId, documentoId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let membership;
  try {
    membership = await assertActiveMembership(session.user.id, clinicaId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!can(membership.role, "documento_read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const doc = await withTenant(
      { clinicaId, userId: session.user.id },
      async (tx) => {
        const rows = await tx
          .select()
          .from(documentosGenerados)
          .where(
            and(
              eq(documentosGenerados.id, documentoId),
              eq(documentosGenerados.clinicaId, clinicaId),
            ),
          )
          .limit(1);
        return rows[0] ?? null;
      },
    );
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const pdf = await readDocumentPdf(clinicaId, doc.rutaStorage);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${doc.tipo}-${doc.id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
