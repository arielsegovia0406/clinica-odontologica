"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ensureVisitaBorradorAction,
  updateSignosVitalesAction,
} from "@/app/app/[clinicaId]/pacientes/actions";
import { signosVitalesSchema } from "@/lib/validation/signos-vitales";

const formSchema = signosVitalesSchema;

type Props = {
  clinicaId: string;
  pacienteId: string;
  hasTratamientoDatos: boolean;
  hasGrabacionAudio: boolean;
  visitaBorrador: {
    id: string;
    signosVitales: {
      presionArterial?: string;
      frecuenciaCardiaca?: number;
      frecuenciaRespiratoria?: number;
      temperatura?: number;
      saturacionO2?: number;
    } | null;
  } | null;
};

type FormValues = z.input<typeof formSchema>;

export function VisitaSignosPanel({
  clinicaId,
  pacienteId,
  hasTratamientoDatos,
  hasGrabacionAudio,
  visitaBorrador,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sv = visitaBorrador?.signosVitales;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      presionArterial: sv?.presionArterial ?? "",
      frecuenciaCardiaca: sv?.frecuenciaCardiaca,
      frecuenciaRespiratoria: sv?.frecuenciaRespiratoria,
      temperatura: sv?.temperatura,
      saturacionO2: sv?.saturacionO2,
    },
  });

  const iniciar = () => {
    setError(null);
    startTransition(async () => {
      const result = await ensureVisitaBorradorAction(clinicaId, pacienteId);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await updateSignosVitalesAction(clinicaId, {
        pacienteId,
        signosVitales: values,
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
      <h2 className="text-xl font-semibold">Atención / signos vitales</h2>
      {!hasTratamientoDatos ? (
        <p className="text-destructive text-base">
          Se requiere consentimiento de tratamiento de datos para iniciar atención.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="sillon"
          variant="outline"
          disabled={!hasTratamientoDatos || pending}
          onClick={iniciar}
        >
          {visitaBorrador ? "Visita borrador activa" : "Iniciar atención"}
        </Button>
        <Button
          type="button"
          size="sillon"
          variant="secondary"
          disabled={!hasGrabacionAudio || !hasTratamientoDatos}
          title={
            hasGrabacionAudio
              ? "Abrir dictado clínico"
              : "Requiere consentimiento de grabación de audio"
          }
          onClick={() =>
            router.push(`/app/${clinicaId}/pacientes/${pacienteId}/dictado`)
          }
        >
          Dictado
        </Button>
      </div>

      {visitaBorrador ? (
        <p className="text-muted-foreground text-sm">
          Visita borrador: {visitaBorrador.id}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="grid max-w-xl gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="presionArterial">Presión arterial</Label>
          <Input
            id="presionArterial"
            placeholder="120/80"
            {...form.register("presionArterial")}
          />
        </div>
        <div>
          <Label htmlFor="frecuenciaCardiaca">FC (lpm)</Label>
          <Input
            id="frecuenciaCardiaca"
            type="number"
            {...form.register("frecuenciaCardiaca")}
          />
        </div>
        <div>
          <Label htmlFor="frecuenciaRespiratoria">FR (rpm)</Label>
          <Input
            id="frecuenciaRespiratoria"
            type="number"
            {...form.register("frecuenciaRespiratoria")}
          />
        </div>
        <div>
          <Label htmlFor="temperatura">Temperatura (°C)</Label>
          <Input
            id="temperatura"
            type="number"
            step="0.1"
            {...form.register("temperatura")}
          />
        </div>
        <div>
          <Label htmlFor="saturacionO2">SpO₂ (%)</Label>
          <Input
            id="saturacionO2"
            type="number"
            {...form.register("saturacionO2")}
          />
        </div>
        {error ? (
          <p className="text-destructive sm:col-span-2">{error}</p>
        ) : null}
        <div className="sm:col-span-2">
          <Button
            type="submit"
            size="sillon"
            disabled={pending || !hasTratamientoDatos}
          >
            {pending ? "Guardando…" : "Guardar signos vitales"}
          </Button>
        </div>
      </form>
    </section>
  );
}
