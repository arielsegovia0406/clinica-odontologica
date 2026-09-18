import Link from "next/link";
import { OdontogramaEditor } from "@/components/odontograma/odontograma-editor";
import { loadOdontogramaEditor } from "./actions";

type Props = {
  params: Promise<{ clinicaId: string; pacienteId: string }>;
};

export default async function OdontogramaPage({ params }: Props) {
  const { clinicaId, pacienteId } = await params;
  const result = await loadOdontogramaEditor(clinicaId, pacienteId);
  if (result.ok === false) {
    return (
      <main className="space-y-4">
        <Link
          href={`/app/${clinicaId}/pacientes/${pacienteId}`}
          className="text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Ficha
        </Link>
        <p className="text-destructive text-base">{result.error}</p>
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
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Odontograma
        </h1>
        <p className="text-muted-foreground text-base">
          Visita {result.data.visitaId.slice(0, 12)}… · Reglas en docs/ODONTOGRAMA.md
        </p>
      </div>
      <OdontogramaEditor clinicaId={clinicaId} initial={result.data} />
    </main>
  );
}
