import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PacienteForm } from "@/components/pacientes/paciente-form";
import {
  requireCapability,
  requireClinicContext,
} from "@/lib/auth/clinic-context";
import { pacientes } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/with-tenant";

type Props = { params: Promise<{ clinicaId: string; pacienteId: string }> };

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export default async function EditarPacientePage({ params }: Props) {
  const { clinicaId, pacienteId } = await params;
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "paciente_write");

  const paciente = await withTenant(
    { clinicaId: ctx.clinicaId, userId: ctx.userId },
    async (tx) => {
      const rows = await tx
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);
      return rows[0] ?? null;
    },
  );
  if (!paciente) notFound();

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link
          href={`/app/${clinicaId}/pacientes/${pacienteId}`}
          className="text-muted-foreground text-base underline-offset-4 hover:underline"
        >
          ← Ficha
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Editar paciente
        </h1>
      </div>
      <PacienteForm
        clinicaId={clinicaId}
        mode="edit"
        pacienteId={pacienteId}
        defaultValues={{
          tipoDocumento: paciente.tipoDocumento,
          numeroDocumento: paciente.numeroDocumento,
          nombres: paciente.nombres,
          apellidos: paciente.apellidos,
          fechaNacimiento: toDateInput(paciente.fechaNacimiento),
          sexo: paciente.sexo,
          direccion: paciente.direccion ?? "",
          telefono: paciente.telefono ?? "",
          email: paciente.email ?? "",
          contactoEmergenciaNombre: paciente.contactoEmergenciaNombre ?? "",
          contactoEmergenciaTelefono: paciente.contactoEmergenciaTelefono ?? "",
          numeroArchivo: paciente.numeroArchivo ?? "",
        }}
      />
    </main>
  );
}
