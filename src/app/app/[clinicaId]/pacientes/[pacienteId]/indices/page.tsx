import Link from "next/link";
import { IndicesEditor } from "@/components/indices/indices-editor";
import { loadIndicesEditor } from "./actions";

type Props = {
  params: Promise<{ clinicaId: string; pacienteId: string }>;
};

export default async function IndicesPage({ params }: Props) {
  const { clinicaId, pacienteId } = await params;
  const result = await loadIndicesEditor(clinicaId, pacienteId);

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
        <p className="text-muted-foreground text-sm">
          Tip: abra Odontograma o “Iniciar atención” en la ficha para crear la
          visita borrador.
        </p>
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
          Índices
        </h1>
        <p className="text-muted-foreground text-base">
          CPO-D, ceo-d e IHOS · docs/INDICES.md
        </p>
      </div>
      <IndicesEditor clinicaId={clinicaId} initial={result.data} />
    </main>
  );
}
