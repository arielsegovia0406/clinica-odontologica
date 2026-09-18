import Link from "next/link";
import { DictadoPanel } from "@/components/dictado/dictado-panel";
import { requireClinicContext } from "@/lib/auth/clinic-context";
import { sttConfigured } from "@/lib/ai/providers";
import { loadPacienteFicha } from "@/app/app/[clinicaId]/pacientes/actions";

type Props = {
  params: Promise<{ clinicaId: string; pacienteId: string }>;
};

export default async function DictadoPage({ params }: Props) {
  const { clinicaId, pacienteId } = await params;
  await requireClinicContext(clinicaId);
  const ficha = await loadPacienteFicha(clinicaId, pacienteId);

  if (!ficha) {
    return (
      <main className="space-y-4">
        <p className="text-destructive">Paciente no encontrado</p>
        <Link href={`/app/${clinicaId}/pacientes`}>← Pacientes</Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <Link
          href={`/app/${clinicaId}/pacientes/${pacienteId}`}
          className="text-muted-foreground text-base underline-offset-4 hover:underline"
        >
          ← Ficha
        </Link>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-[var(--clinic-mint)]">
          Dictado clínico
        </h1>
        <p className="text-base text-[var(--clinic-steel)]">
          {ficha.paciente.apellidos}, {ficha.paciente.nombres} · La IA propone,
          usted dispone · docs/DICTADO.md
        </p>
      </div>
      <DictadoPanel
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        hasGrabacionAudio={ficha.hasGrabacionAudio}
        hasVisitaBorrador={ficha.visitaBorrador != null}
        sttConfiguredHint={sttConfigured()}
      />
      <Link
        href={`/app/${clinicaId}/pacientes/${pacienteId}/odontograma`}
        className="text-[var(--clinic-aqua)] text-base underline-offset-4 hover:underline"
      >
        Abrir odontograma →
      </Link>
    </main>
  );
}
