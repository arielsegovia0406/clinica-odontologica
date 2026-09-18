import Link from "next/link";
import { Suspense } from "react";
import { ilike, or } from "drizzle-orm";
import { requireClinicContext } from "@/lib/auth/clinic-context";
import { pacientes } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/with-tenant";
import { PacienteSearch } from "@/components/pacientes/paciente-search";

type Props = {
  params: Promise<{ clinicaId: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function PacientesPage({ params, searchParams }: Props) {
  const { clinicaId } = await params;
  const { q = "" } = await searchParams;
  const ctx = await requireClinicContext(clinicaId);
  const query = q.trim();

  const rows = await withTenant(
    { clinicaId: ctx.clinicaId, userId: ctx.userId },
    async (tx) => {
      if (!query) {
        return tx
          .select({
            id: pacientes.id,
            nombres: pacientes.nombres,
            apellidos: pacientes.apellidos,
            numeroDocumento: pacientes.numeroDocumento,
            tipoDocumento: pacientes.tipoDocumento,
            numeroArchivo: pacientes.numeroArchivo,
          })
          .from(pacientes)
          .orderBy(pacientes.apellidos, pacientes.nombres)
          .limit(50);
      }
      const pattern = `%${query}%`;
      return tx
        .select({
          id: pacientes.id,
          nombres: pacientes.nombres,
          apellidos: pacientes.apellidos,
          numeroDocumento: pacientes.numeroDocumento,
          tipoDocumento: pacientes.tipoDocumento,
          numeroArchivo: pacientes.numeroArchivo,
        })
        .from(pacientes)
        .where(
          or(
            ilike(pacientes.nombres, pattern),
            ilike(pacientes.apellidos, pattern),
            ilike(pacientes.numeroDocumento, pattern),
            ilike(pacientes.numeroArchivo, pattern),
          ),
        )
        .orderBy(pacientes.apellidos, pacientes.nombres)
        .limit(50);
    },
  );

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground text-base">
            Listado y búsqueda · {ctx.role}
          </p>
        </div>
        <Link
          href={`/app/${clinicaId}/pacientes/nuevo`}
          className="bg-primary text-primary-foreground inline-flex h-12 min-w-48 items-center justify-center rounded-lg px-4 text-base font-medium"
        >
          Nuevo paciente
        </Link>
      </div>

      <Suspense fallback={null}>
        <PacienteSearch clinicaId={clinicaId} initialQ={query} />
      </Suspense>

      <ul className="divide-border divide-y rounded-lg border">
        {rows.map((p) => (
          <li key={p.id}>
            <Link
              href={`/app/${clinicaId}/pacientes/${p.id}`}
              className="hover:bg-muted/50 flex min-h-14 items-center justify-between gap-4 px-4 py-3 text-base"
            >
              <span className="font-medium">
                {p.apellidos}, {p.nombres}
              </span>
              <span className="text-muted-foreground">
                {p.tipoDocumento} {p.numeroDocumento}
                {p.numeroArchivo ? ` · ${p.numeroArchivo}` : ""}
              </span>
            </Link>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="text-muted-foreground px-4 py-8 text-base">
            No hay pacientes{query ? " para esa búsqueda" : ""}.
          </li>
        ) : null}
      </ul>
    </main>
  );
}
