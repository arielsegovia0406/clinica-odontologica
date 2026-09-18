import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { dbMigrator } from "@/lib/db/client";
import { member, organization } from "@/lib/db/schema";
import { SelectClinicaClient } from "./select-clinica-client";

export default async function SelectClinicaPage({
  searchParams,
}: {
  searchParams: Promise<{ elegir?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  const { elegir } = await searchParams;

  const rows = await dbMigrator
    .select({
      memberId: member.id,
      role: member.role,
      clinicaId: organization.id,
      name: organization.name,
      slug: organization.slug,
      inactividadMinutos: organization.inactividadMinutos,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(
      and(eq(member.userId, session.user.id), eq(member.estado, "activa")),
    );

  if (rows.length === 0) {
    return (
      <main className="bg-background flex min-h-full flex-1 items-center justify-center p-8">
        <p className="text-lg text-[var(--clinic-mint)]">
          No tiene membresías activas en ninguna clínica.
        </p>
      </main>
    );
  }

  // Una sola clínica: entrar directo, salvo ?elegir=1 (probar / cambiar)
  if (rows.length === 1 && elegir !== "1") {
    redirect(`/app/${rows[0]!.clinicaId}`);
  }

  return (
    <main className="bg-background flex min-h-full flex-1 items-center justify-center p-6">
      <SelectClinicaClient
        clinicas={rows.map((r) => ({
          id: r.clinicaId,
          name: r.name,
          role: r.role,
          inactividadMinutos: r.inactividadMinutos,
        }))}
      />
    </main>
  );
}
