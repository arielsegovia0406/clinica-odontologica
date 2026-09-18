import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { assertActiveMembership, withTenant } from "@/lib/db/with-tenant";
import { solicitudesArco } from "@/lib/db/schema";
import { readArcoExportJson } from "@/lib/arco/storage";
import { can } from "@/lib/clinical/permissions";

type Params = {
  params: Promise<{ clinicaId: string; solicitudId: string }>;
};

export async function GET(_req: NextRequest, { params }: Params) {
  const { clinicaId, solicitudId } = await params;
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

  const mayDownload =
    can(membership.role, "arco_admin") ||
    can(membership.role, "arco_solicitar");
  if (!mayDownload) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const row = await withTenant(
      { clinicaId, userId: session.user.id },
      async (tx) => {
        const rows = await tx
          .select()
          .from(solicitudesArco)
          .where(
            and(
              eq(solicitudesArco.id, solicitudId),
              eq(solicitudesArco.clinicaId, clinicaId),
            ),
          )
          .limit(1);
        return rows[0] ?? null;
      },
    );

    if (!row?.resultadoRuta || row.tipo !== "exportacion") {
      return NextResponse.json({ error: "Export no disponible" }, { status: 404 });
    }

    const buf = await readArcoExportJson(clinicaId, row.resultadoRuta);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="arco-${solicitudId}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error al descargar",
      },
      { status: 500 },
    );
  }
}
