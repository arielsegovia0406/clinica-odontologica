"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recalcularIndicesDesdeOdontogramaAction,
  saveIhosPiezasAction,
  sobrescribirIndicesAction,
  type IndicesEditorPayload,
} from "@/app/app/[clinicaId]/pacientes/[pacienteId]/indices/actions";
import type { IhosPiezaExaminada } from "@/lib/clinical/indices";

type Props = {
  clinicaId: string;
  initial: IndicesEditorPayload;
};

export function IndicesEditor({ clinicaId, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState(initial.stored);
  const [calculated, setCalculated] = useState(initial.calculated);
  const [piezas, setPiezas] = useState(initial.piezasIhos);
  const [ihos, setIhos] = useState(initial.ihosComputed);
  const [motivo, setMotivo] = useState("");
  const [override, setOverride] = useState({
    c: initial.stored.c,
    p: initial.stored.p,
    o: initial.stored.o,
    cTemporal: initial.stored.cTemporal,
    eTemporal: initial.stored.eTemporal,
    oTemporal: initial.stored.oTemporal,
  });

  function updatePieza(
    idx: number,
    field: keyof IhosPiezaExaminada,
    value: number,
  ) {
    setPiezas((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="border-border space-y-4 rounded-xl border p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl text-[var(--clinic-mint)]">
              CPO-D / ceo-d
            </h2>
            <p className="text-muted-foreground text-sm">
              Calculado desde odontograma (Klein-Palmer / ceo-d). Fuentes en
              docs/INDICES.md
            </p>
          </div>
          <Button
            type="button"
            size="sillon"
            variant="outline"
            disabled={pending || !initial.odontogramaId}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await recalcularIndicesDesdeOdontogramaAction(
                  clinicaId,
                  initial.visitaId,
                );
                if (result.ok === false) {
                  setError(result.error);
                  return;
                }
                setCalculated(result.data);
                setStored((s) => ({
                  ...s,
                  ...result.data,
                  sobrescritoManual: false,
                  motivoSobrescritura: null,
                }));
                setOverride({
                  c: result.data.c,
                  p: result.data.p,
                  o: result.data.o,
                  cTemporal: result.data.cTemporal,
                  eTemporal: result.data.eTemporal,
                  oTemporal: result.data.oTemporal,
                });
                router.refresh();
              });
            }}
          >
            Recalcular desde odontograma
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ["C", calculated.c],
              ["P", calculated.p],
              ["O", calculated.o],
              ["CPO-D", calculated.cpoD],
              ["c", calculated.cTemporal],
              ["e", calculated.eTemporal],
              ["o", calculated.oTemporal],
              ["ceo-d", calculated.ceoD],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--clinic-steel)]/30 bg-[var(--clinic-navy)]/10 px-3 py-3"
            >
              <p className="text-[var(--clinic-aqua)] text-sm">{label}</p>
              <p className="text-2xl font-semibold text-[var(--clinic-mint)]">
                {value}
              </p>
            </div>
          ))}
        </div>

        {stored.sobrescritoManual ? (
          <p className="text-[var(--clinic-sky)] text-sm">
            Valores sobrescritos manualmente
            {stored.motivoSobrescritura
              ? `: ${stored.motivoSobrescritura}`
              : ""}
          </p>
        ) : null}

        <details className="rounded-lg border border-[var(--clinic-steel)]/25 p-3">
          <summary className="min-h-12 cursor-pointer text-base font-medium">
            Sobrescribir manualmente
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["c", "C"],
                ["p", "P"],
                ["o", "O"],
                ["cTemporal", "c temp."],
                ["eTemporal", "e temp."],
                ["oTemporal", "o temp."],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  type="number"
                  min={0}
                  value={override[key]}
                  onChange={(e) =>
                    setOverride((o) => ({
                      ...o,
                      [key]: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            ))}
            <div className="sm:col-span-3">
              <Label htmlFor="motivo">Motivo (obligatorio)</Label>
              <Input
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            size="sillon"
            className="mt-3"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await sobrescribirIndicesAction(
                  clinicaId,
                  initial.visitaId,
                  { ...override, cpoD: 0, ceoD: 0, motivo },
                );
                if (result.ok === false) {
                  setError(result.error);
                  return;
                }
                router.refresh();
              });
            }}
          >
            Guardar sobrescritura
          </Button>
        </details>
      </section>

      <section className="border-border space-y-4 rounded-xl border p-4">
        <div>
          <h2 className="font-heading text-xl text-[var(--clinic-mint)]">
            IHOS (Greene &amp; Vermillion 1964)
          </h2>
          <p className="text-muted-foreground text-sm">
            Seis dientes índice · placa/cálculo 0–3 · gingivitis 0–1
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-base">
            <thead className="text-[var(--clinic-steel)]">
              <tr>
                <th className="px-2 py-3">Índice</th>
                <th className="px-2 py-3">Usada</th>
                <th className="px-2 py-3">Placa</th>
                <th className="px-2 py-3">Cálculo</th>
                <th className="px-2 py-3">Ging.</th>
              </tr>
            </thead>
            <tbody>
              {piezas.map((p, idx) => (
                <tr key={p.principal} className="border-t border-[var(--clinic-steel)]/20">
                  <td className="px-2 py-2">{p.principal}</td>
                  <td className="px-2 py-2">{p.usada}</td>
                  {(["placa", "calculo", "gingivitis"] as const).map((field) => (
                    <td key={field} className="px-2 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={field === "gingivitis" ? 1 : 3}
                        className="h-12 w-20"
                        value={p[field]}
                        onChange={(e) =>
                          updatePieza(idx, field, Number(e.target.value) || 0)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {(
            [
              ["Placa (DI-S)", ihos.ihosPlaca],
              ["Cálculo (CI-S)", ihos.ihosCalculo],
              ["OHI-S", ihos.ohiS],
              ["Gingivitis media", ihos.ihosGingivitis],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--clinic-cyan)]/25 px-3 py-3"
            >
              <p className="text-[var(--clinic-powder)] text-sm">{label}</p>
              <p className="text-2xl font-semibold">{value ?? "—"}</p>
            </div>
          ))}
        </div>

        <Button
          type="button"
          size="sillon"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await saveIhosPiezasAction(
                clinicaId,
                initial.visitaId,
                piezas,
              );
              if (result.ok === false) {
                setError(result.error);
                return;
              }
              setIhos(result.data);
              router.refresh();
            });
          }}
        >
          Guardar IHOS
        </Button>
      </section>

      {error ? <p className="text-destructive text-base">{error}</p> : null}
    </div>
  );
}
