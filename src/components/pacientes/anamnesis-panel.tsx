"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAnamnesisVersionAction } from "@/app/app/[clinicaId]/pacientes/actions";
import {
  anamnesisCreateSchema,
  type AnamnesisCreateInput,
} from "@/lib/validation/anamnesis";

type VersionRow = {
  id: string;
  version: number;
  antecedentesPersonales: string | null;
  antecedentesFamiliares: string | null;
  alergias: string | null;
  medicacionActual: string | null;
  embarazoLactancia: string | null;
  habitos: string | null;
  registradoEn: Date | string;
};

type Props = {
  clinicaId: string;
  pacienteId: string;
  canRead: boolean;
  canWrite: boolean;
  anamnesisExists: boolean;
  anamnesisCount: number;
  versions: VersionRow[];
  hasTratamientoDatos: boolean;
};

export function AnamnesisPanel({
  clinicaId,
  pacienteId,
  canRead,
  canWrite,
  anamnesisExists,
  anamnesisCount,
  versions,
  hasTratamientoDatos,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const latest = versions[0];

  const form = useForm<AnamnesisCreateInput>({
    resolver: zodResolver(anamnesisCreateSchema),
    defaultValues: {
      pacienteId,
      antecedentesPersonales: latest?.antecedentesPersonales ?? "",
      antecedentesFamiliares: latest?.antecedentesFamiliares ?? "",
      alergias: latest?.alergias ?? "",
      medicacionActual: latest?.medicacionActual ?? "",
      embarazoLactancia: latest?.embarazoLactancia ?? "",
      habitos: latest?.habitos ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createAnamnesisVersionAction(clinicaId, values);
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  });

  if (!canRead) {
    return (
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Anamnesis</h2>
        <p className="text-muted-foreground text-base">
          {anamnesisExists
            ? `Hay ${anamnesisCount} versión(es) registrada(s). El rol auxiliar no puede ver el contenido clínico.`
            : "Sin anamnesis registrada. El rol auxiliar no puede ver ni editar anamnesis."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Anamnesis</h2>
      {!hasTratamientoDatos ? (
        <p className="text-destructive text-base">
          Registre el consentimiento de tratamiento de datos antes de capturar anamnesis.
        </p>
      ) : null}

      {canWrite ? (
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4">
          {(
            [
              ["antecedentesPersonales", "Antecedentes personales"],
              ["antecedentesFamiliares", "Antecedentes familiares"],
              ["alergias", "Alergias"],
              ["medicacionActual", "Medicación actual"],
              ["embarazoLactancia", "Embarazo / lactancia"],
              ["habitos", "Hábitos"],
            ] as const
          ).map(([name, label]) => (
            <div key={name}>
              <Label htmlFor={name}>{label}</Label>
              <Textarea id={name} {...form.register(name)} />
            </div>
          ))}
          {error ? <p className="text-destructive">{error}</p> : null}
          <Button
            type="submit"
            size="sillon"
            disabled={pending || !hasTratamientoDatos}
          >
            {pending
              ? "Guardando…"
              : latest
                ? `Guardar nueva versión (v${latest.version + 1})`
                : "Guardar anamnesis (v1)"}
          </Button>
        </form>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Historial de versiones</h3>
        {versions.length === 0 ? (
          <p className="text-muted-foreground">Sin versiones aún.</p>
        ) : (
          <ul className="space-y-3">
            {versions.map((v) => (
              <li key={v.id} className="rounded-lg border p-4 text-base">
                <p className="font-medium">
                  Versión {v.version} ·{" "}
                  {new Date(v.registradoEn).toLocaleString("es-EC")}
                </p>
                <dl className="mt-2 grid gap-1 text-sm">
                  <div>
                    <dt className="text-muted-foreground inline">Alergias: </dt>
                    <dd className="inline">{v.alergias || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground inline">Medicación: </dt>
                    <dd className="inline">{v.medicacionActual || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground inline">Hábitos: </dt>
                    <dd className="inline">{v.habitos || "—"}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
