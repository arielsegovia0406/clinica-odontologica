"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptDictadoProposalsAction,
  processDictadoAction,
  type DictadoSessionPayload,
} from "@/app/app/[clinicaId]/pacientes/[pacienteId]/dictado/actions";
import type { MappedProposal } from "@/lib/clinical/dictado-mapper";
import type { Transition } from "@/lib/clinical/odontograma";

type Props = {
  clinicaId: string;
  pacienteId: string;
  hasGrabacionAudio: boolean;
  hasVisitaBorrador: boolean;
  sttConfiguredHint: boolean;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function DictadoPanel({
  clinicaId,
  pacienteId,
  hasGrabacionAudio,
  hasVisitaBorrador,
  sttConfiguredHint,
}: Props) {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<DictadoSessionPayload | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => stopListening(), [stopListening]);

  function startListening() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError(
        "Este navegador no soporta reconocimiento de voz. Escriba o pegue el dictado.",
      );
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = "es-EC";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      const parts: string[] = [];
      for (let i = 0; i < ev.results.length; i++) {
        parts.push(ev.results[i]![0]!.transcript);
      }
      setTranscript(parts.join(" ").trim());
    };
    rec.onerror = (ev) => {
      setError(`Voz: ${ev.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  function runExtract() {
    setError(null);
    setResultMsg(null);
    startTransition(async () => {
      const result = await processDictadoAction(clinicaId, pacienteId, {
        transcript,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setSession(result.data);
      const init: Record<string, boolean> = {};
      for (const p of result.data.proposals) {
        init[p.id] = p.transition != null && !p.rejectedReason;
      }
      setSelected(init);
    });
  }

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function acceptSelected() {
    if (!session) return;
    const accepted: Array<{ id: string; transition: Transition }> = [];
    for (const p of session.proposals) {
      if (selected[p.id] && p.transition) {
        accepted.push({ id: p.id, transition: p.transition });
      }
    }
    if (accepted.length === 0) {
      setError("Seleccione al menos una propuesta válida");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await acceptDictadoProposalsAction(clinicaId, pacienteId, {
        sesionId: session.sesionId,
        odontogramaId: session.odontogramaId,
        accepted,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setResultMsg(
        `Aplicados ${result.data.applied}` +
          (result.data.errors.length
            ? ` · errores: ${result.data.errors.join("; ")}`
            : ""),
      );
      router.refresh();
    });
  }

  if (!hasGrabacionAudio) {
    return (
      <p className="text-destructive text-base">
        Registre el consentimiento de <strong>grabación de audio</strong> en la
        ficha para habilitar el dictado.
      </p>
    );
  }

  if (!hasVisitaBorrador) {
    return (
      <p className="text-[var(--clinic-powder)] text-base">
        Inicie atención (visita borrador) en la ficha antes de dictar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="space-y-3 rounded-xl border border-[var(--clinic-steel)]/35 bg-card p-4">
        <h2 className="font-heading text-xl text-[var(--clinic-mint)]">
          Transcripción
        </h2>
        <p className="text-sm text-[var(--clinic-steel)]">
          La IA solo propone hallazgos <em>mencionados</em>. Ejemplos: «caries en
          16 oclusal», «26 obturado», «ausente 36», «borrar pieza 11».
          {sttConfiguredHint
            ? " STT (Whisper) disponible en servidor."
            : " Sin API STT: use voz del navegador o texto."}
        </p>
        <Label htmlFor="transcript">Texto del dictado</Label>
        <Textarea
          id="transcript"
          className="min-h-32 text-[var(--clinic-mint)]"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Caries en 16 oclusal y 26 obturado…"
        />
        <div className="flex flex-wrap gap-3">
          {!listening ? (
            <Button
              type="button"
              size="sillon"
              variant="outline"
              disabled={pending}
              onClick={startListening}
            >
              Dictar (micrófono)
            </Button>
          ) : (
            <Button
              type="button"
              size="sillon"
              variant="destructive"
              onClick={stopListening}
            >
              Detener micrófono
            </Button>
          )}
          <Button
            type="button"
            size="sillon"
            disabled={pending || transcript.trim().length < 2}
            onClick={runExtract}
          >
            {pending ? "Procesando…" : "Extraer propuestas"}
          </Button>
        </div>
      </section>

      {session ? (
        <section className="space-y-4 rounded-xl border border-[var(--clinic-cyan)]/30 bg-card p-4">
          <div>
            <h2 className="font-heading text-xl text-[var(--clinic-mint)]">
              Propuestas (revisar antes de aplicar)
            </h2>
            <p className="text-sm text-[var(--clinic-steel)]">
              Sesión {session.sesionId.slice(0, 12)}… · extractor{" "}
              {session.modeloLlm} · {session.latenciaMs} ms
            </p>
          </div>

          {session.extraction.diagnosticosSugeridos.length > 0 ? (
            <div className="rounded-lg border border-[var(--clinic-sky)]/30 p-3 text-sm text-[var(--clinic-powder)]">
              <p className="font-medium">Diagnósticos sugeridos (no se aplican solos)</p>
              <ul className="mt-1 list-disc pl-5">
                {session.extraction.diagnosticosSugeridos.map((d, i) => (
                  <li key={i}>
                    {d.descripcion}
                    {d.cie10 ? ` · ${d.cie10}` : ""} ({Math.round(d.confianza * 100)}
                    %)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="space-y-2">
            {session.proposals.map((p: MappedProposal) => (
              <li
                key={p.id}
                className="flex min-h-12 items-start gap-3 rounded-lg border border-[var(--clinic-steel)]/25 px-3 py-3"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5"
                  checked={Boolean(selected[p.id])}
                  disabled={!p.transition}
                  onChange={() => toggle(p.id)}
                />
                <div className="flex-1 text-base text-[var(--clinic-mint)]">
                  <p>{p.label}</p>
                  <p className="text-sm text-[var(--clinic-steel)]">
                    confianza {Math.round(p.confianza * 100)}%
                    {p.rejectedReason ? ` · ${p.rejectedReason}` : ""}
                  </p>
                </div>
              </li>
            ))}
            {session.proposals.length === 0 ? (
              <li className="text-[var(--clinic-powder)]">
                No se detectaron hallazgos explícitos. Reformule el dictado.
              </li>
            ) : null}
          </ul>

          <Button
            type="button"
            size="sillon"
            disabled={pending}
            onClick={acceptSelected}
          >
            Aplicar seleccionados al odontograma
          </Button>
        </section>
      ) : null}

      {resultMsg ? (
        <p className="text-base text-[var(--clinic-aqua)]">{resultMsg}</p>
      ) : null}
      {error ? <p className="text-destructive text-base">{error}</p> : null}
    </div>
  );
}
