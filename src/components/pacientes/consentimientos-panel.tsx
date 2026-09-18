"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createConsentimientoAction } from "@/app/app/[clinicaId]/pacientes/actions";
import {
  consentimientoCreateSchema,
  type ConsentimientoCreateInput,
} from "@/lib/validation/consentimiento";

type CatalogEntry = { version: string; texto: string; hash: string };

type ConsentRow = {
  id: string;
  tipo: "tratamiento_datos" | "grabacion_audio";
  versionTexto: string;
  textoHash: string;
  aceptadoEn: Date | string;
  metodo: string;
  revocadoEn: Date | string | null;
};

type Props = {
  clinicaId: string;
  pacienteId: string;
  catalog: {
    tratamiento_datos: CatalogEntry;
    grabacion_audio: CatalogEntry;
  };
  consents: ConsentRow[];
  hasTratamientoDatos: boolean;
  hasGrabacionAudio: boolean;
};

export function ConsentimientosPanel({
  clinicaId,
  pacienteId,
  catalog,
  consents,
  hasTratamientoDatos,
  hasGrabacionAudio,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState<"tratamiento_datos" | "grabacion_audio">(
    "tratamiento_datos",
  );

  const form = useForm<ConsentimientoCreateInput>({
    resolver: zodResolver(consentimientoCreateSchema),
    defaultValues: {
      pacienteId,
      tipo: "tratamiento_datos",
      metodo: "checkbox_explicito",
      versionTexto: catalog.tratamiento_datos.version,
    },
  });

  const entry = catalog[tipo];

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createConsentimientoAction(clinicaId, {
        ...values,
        tipo,
        versionTexto: catalog[tipo].version,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  });

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Consentimientos</h2>
      <ul className="space-y-2 text-base">
        <li>
          Tratamiento de datos:{" "}
          <strong>{hasTratamientoDatos ? "Vigente" : "Pendiente"}</strong>
        </li>
        <li>
          Grabación de audio:{" "}
          <strong>{hasGrabacionAudio ? "Vigente" : "Pendiente"}</strong>
        </li>
      </ul>

      {consents.length > 0 ? (
        <ul className="divide-border divide-y rounded-lg border text-sm">
          {consents.map((c) => (
            <li key={c.id} className="flex min-h-12 flex-col justify-center gap-0.5 px-4 py-3">
              <span className="font-medium">
                {c.tipo === "tratamiento_datos"
                  ? "Tratamiento de datos"
                  : "Grabación de audio"}
                {c.revocadoEn ? " (revocado)" : ""}
              </span>
              <span className="text-muted-foreground">
                v{c.versionTexto} · {new Date(c.aceptadoEn).toLocaleString("es-EC")} ·{" "}
                {c.metodo}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4">
        <div>
          <Label htmlFor="consent-tipo">Tipo</Label>
          <Select
            id="consent-tipo"
            value={tipo}
            onChange={(e) => {
              const next = e.target.value as typeof tipo;
              setTipo(next);
              form.setValue("tipo", next);
              form.setValue("versionTexto", catalog[next].version);
            }}
          >
            <option value="tratamiento_datos">Tratamiento de datos</option>
            <option value="grabacion_audio">Grabación de audio</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="consent-metodo">Método</Label>
          <Select id="consent-metodo" {...form.register("metodo")}>
            <option value="checkbox_explicito">Checkbox explícito</option>
            <option value="firma_pantalla">Firma en pantalla</option>
            <option value="papel_digitalizado">Papel digitalizado</option>
          </Select>
        </div>
        <div className="bg-muted/40 max-h-48 overflow-auto rounded-lg border p-3 text-sm whitespace-pre-wrap">
          <p className="text-muted-foreground mb-2">
            Versión {entry.version} · hash {entry.hash.slice(0, 12)}…
          </p>
          {entry.texto}
        </div>
        <label className="flex min-h-12 items-start gap-3 text-base">
          <input
            type="checkbox"
            required
            className="mt-1 size-5"
          />
          <span>He leído y el paciente acepta este texto (versión {entry.version}).</span>
        </label>
        {error ? <p className="text-destructive">{error}</p> : null}
        <Button type="submit" size="sillon" disabled={pending}>
          {pending ? "Registrando…" : "Registrar consentimiento"}
        </Button>
      </form>
    </section>
  );
}
