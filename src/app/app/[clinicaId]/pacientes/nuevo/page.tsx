import Link from "next/link";
import { PacienteForm } from "@/components/pacientes/paciente-form";
import { requireClinicContext, requireCapability } from "@/lib/auth/clinic-context";

type Props = { params: Promise<{ clinicaId: string }> };

export default async function NuevoPacientePage({ params }: Props) {
  const { clinicaId } = await params;
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "paciente_write");

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link
          href={`/app/${clinicaId}/pacientes`}
          className="text-muted-foreground text-base underline-offset-4 hover:underline"
        >
          ← Pacientes
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Nuevo paciente
        </h1>
      </div>
      <PacienteForm clinicaId={clinicaId} mode="create" />
    </main>
  );
}
