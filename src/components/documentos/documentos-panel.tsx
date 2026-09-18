"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  firmarYGenerar033Action,
  listDocumentosVisitaAction,
  type DocumentoListItem,
} from "@/app/app/[clinicaId]/pacientes/[pacienteId]/documentos/actions";

type Props = {
  clinicaId: string;
  pacienteId: string;
  canFirmar: boolean;
  estadoVisita: string | null;
  visitaId: string | null;
  initialDocs: DocumentoListItem[];
};

export function DocumentosPanel({
  clinicaId,
  pacienteId,
  canFirmar,
  estadoVisita,
  visitaId,
  initialDocs,
}: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState(initialDocs);
  const [estado, setEstado] = useState(estadoVisita);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-4 rounded-xl border border-[var(--clinic-steel)]/35 bg-card p-4">
      <div>
        <h2 className="font-heading text-xl text-[var(--clinic-mint)]">
          Documentos / Formulario 033
        </h2>
        <p className="text-sm text-[var(--clinic-steel)]">
          Resumen clínico PDF (no facsímil oficial MSP). Firma dibujada stub ·
          docs/DOCUMENTOS.md
        </p>
        {visitaId ? (
          <p className="mt-1 text-sm text-[var(--clinic-powder)]">
            Visita {visitaId.slice(0, 12)}… · estado{" "}
            <strong className="text-[var(--clinic-aqua)]">
              {estado ?? "—"}
            </strong>
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--clinic-powder)]">
            Sin visita — inicie atención primero.
          </p>
        )}
      </div>

      {canFirmar && estado === "borrador" ? (
        <Button
          type="button"
          size="sillon"
          disabled={pending || !visitaId}
          onClick={() => {
            setError(null);
            setMsg(null);
            startTransition(async () => {
              const result = await firmarYGenerar033Action(
                clinicaId,
                pacienteId,
              );
              if (result.ok === false) {
                setError(result.error);
                return;
              }
              setMsg("Visita firmada y PDF generado");
              setEstado("firmada");
              const listed = await listDocumentosVisitaAction(
                clinicaId,
                pacienteId,
              );
              if (listed.ok) setDocs(listed.data.documentos);
              router.refresh();
            });
          }}
        >
          {pending ? "Generando…" : "Firmar y generar 033"}
        </Button>
      ) : null}

      {!canFirmar ? (
        <p className="text-sm text-[var(--clinic-steel)]">
          Solo odontólogo/admin pueden firmar el documento.
        </p>
      ) : null}

      {estado === "firmada" ? (
        <p className="text-sm text-[var(--clinic-aqua)]">
          Visita firmada: odontograma inmutable.
        </p>
      ) : null}

      <ul className="space-y-2">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[var(--clinic-steel)]/20 py-2 text-[var(--clinic-mint)]"
          >
            <span>
              {d.tipo} · {new Date(d.generadoEn).toLocaleString("es-EC")}
            </span>
            <a
              className="inline-flex h-12 items-center rounded-lg border border-[var(--clinic-cyan)]/40 px-4 text-base text-[var(--clinic-cyan)]"
              href={`/api/clinica/${clinicaId}/documentos/${d.id}`}
            >
              Descargar PDF
            </a>
          </li>
        ))}
        {docs.length === 0 ? (
          <li className="text-[var(--clinic-steel)]">Sin documentos aún</li>
        ) : null}
      </ul>

      {msg ? <p className="text-[var(--clinic-aqua)]">{msg}</p> : null}
      {error ? <p className="text-destructive">{error}</p> : null}
    </section>
  );
}
