"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OdontogramaGrid } from "@/components/odontograma/odontograma-grid";
import {
  applyOdontogramaTransitionAction,
  setDenticionAction,
  undoOdontogramaSnapshotAction,
  addTramoAction,
  deleteTramoAction,
  type OdontogramaEditorPayload,
} from "@/app/app/[clinicaId]/pacientes/[pacienteId]/odontograma/actions";
import {
  applyTransition,
  type AppliedTransition,
  type CaraDental,
  type Denticion,
  type EstadoCara,
  type EstadoPieza,
  type OdontogramaSnapshot,
  type Transition,
  isUpperArch,
  isAnterior,
} from "@/lib/clinical/odontograma";
import { GRADO_ESCALA } from "@/lib/clinical/odontograma-config";
import { isLikelyNetworkError } from "@/lib/offline/network";
import { enqueueOdontogramaTransition } from "@/lib/offline/queue";

const ESTADOS_PIEZA: (EstadoPieza | "")[] = [
  "",
  "sano",
  "extraccion_indicada",
  "perdida_caries",
  "perdida_otra_causa",
  "ausente",
  "endodoncia_indicada",
  "endodoncia_realizada",
  "corona_indicada",
  "corona_realizada",
];

const ESTADOS_CARA: EstadoCara[] = [
  "caries",
  "obturado",
  "sellante_necesario",
  "sellante_realizado",
];

type Props = {
  clinicaId: string;
  initial: OdontogramaEditorPayload;
};

export function OdontogramaEditor({ clinicaId, initial }: Props) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial.snapshot);
  const [reference] = useState(initial.reference);
  const [tramos, setTramos] = useState(initial.tramos);
  const [selected, setSelected] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<AppliedTransition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [tramoPiezas, setTramoPiezas] = useState("");
  const [tramoTipo, setTramoTipo] = useState<"fija" | "removible" | "total">(
    "fija",
  );

  const diente = useMemo(
    () => snapshot.dientes.find((d) => d.piezaFdi === selected),
    [snapshot, selected],
  );

  const carasDisponibles = useMemo((): CaraDental[] => {
    if (selected == null) return [];
    const base: CaraDental[] = ["vestibular", "mesial", "distal"];
    if (isUpperArch(selected)) base.push("palatino");
    else base.push("lingual");
    if (isAnterior(selected)) base.push("incisal");
    else base.push("oclusal");
    return base;
  }, [selected]);

  function runTransition(transition: Transition) {
    setError(null);
    startTransition(async () => {
      try {
        const applied = applyTransition(snapshot, transition, {
          immutable: initial.inmutable,
          reference,
        });

        const saveLocal = async () => {
          await enqueueOdontogramaTransition({
            clinicaId,
            pacienteId: initial.pacienteId,
            odontogramaId: initial.odontogramaId,
            transition,
          });
          setSnapshot(applied.after);
          setUndoStack((s) => [...s, applied]);
          setError(
            "Sin red: cambio guardado en este dispositivo. Se sincronizará al recuperar conexión.",
          );
        };

        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          await saveLocal();
          return;
        }

        try {
          const result = await applyOdontogramaTransitionAction(
            clinicaId,
            initial.odontogramaId,
            transition,
          );
          if (result.ok === false) {
            setError(result.error);
            return;
          }
          setSnapshot(result.data.snapshot);
          setUndoStack((s) => [...s, applied]);
        } catch (netErr) {
          if (!isLikelyNetworkError(netErr)) throw netErr;
          await saveLocal();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error de validación");
      }
    });
  }

  function onUndo() {
    const last = undoStack[undoStack.length - 1];
    if (!last || !("piezaFdi" in last.forward)) return;
    setError(null);
    startTransition(async () => {
      const result = await undoOdontogramaSnapshotAction(
        clinicaId,
        initial.odontogramaId,
        last.before,
        last.forward.piezaFdi,
      );
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setSnapshot(result.data.snapshot);
      setUndoStack((s) => s.slice(0, -1));
    });
  }

  function onDenticion(next: Denticion) {
    setError(null);
    startTransition(async () => {
      const result = await setDenticionAction(
        clinicaId,
        initial.odontogramaId,
        next,
      );
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setSnapshot((s) => ({ ...s, denticion: next }));
      router.refresh();
    });
  }

  function onPromote() {
    if (selected == null) return;
    runTransition({ type: "promote_from_reference", piezaFdi: selected });
  }

  function onAddTramo() {
    const piezas = tramoPiezas
      .split(/[,\s]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    setError(null);
    startTransition(async () => {
      const result = await addTramoAction(clinicaId, initial.odontogramaId, {
        tipo: tramoTipo,
        piezasOrdenadas: piezas,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      setTramos((t) => [
        ...t,
        {
          id: result.data.id,
          tipo: tramoTipo,
          piezasOrdenadas: piezas.sort((a, b) => a - b),
          estado: null,
        },
      ]);
      setTramoPiezas("");
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="denticion">Dentición</Label>
          <Select
            id="denticion"
            value={snapshot.denticion}
            disabled={initial.inmutable || pending}
            onChange={(e) => onDenticion(e.target.value as Denticion)}
          >
            <option value="permanente">Permanente</option>
            <option value="temporal">Temporal</option>
            <option value="mixta">Mixta</option>
          </Select>
          <p className="mt-1 text-sm text-[var(--clinic-steel)]">
            Sugerida por edad: {initial.denticionSugerida}
          </p>
        </div>
        <Button
          type="button"
          size="sillon"
          variant="outline"
          disabled={undoStack.length === 0 || pending || initial.inmutable}
          onClick={onUndo}
        >
          Deshacer
        </Button>
      </div>

      {initial.inmutable ? (
        <p className="text-destructive text-base">
          Odontograma inmutable (visita firmada). Solo lectura.
        </p>
      ) : null}

      <OdontogramaGrid
        snapshot={snapshot}
        selected={selected}
        onSelect={setSelected}
        title="Registro actual (vacío = no examinado)"
      />

      {reference ? (
        <div className="space-y-3 border-t pt-6">
          <OdontogramaGrid
            snapshot={reference}
            selected={selected}
            onSelect={setSelected}
            ghost
            title="Referencia visita anterior (solo lectura — tocar pieza y promover)"
          />
          <Button
            type="button"
            size="sillon"
            variant="secondary"
            disabled={selected == null || pending || initial.inmutable}
            onClick={onPromote}
          >
            Promover pieza {selected ?? ""} al registro actual
          </Button>
        </div>
      ) : (
        <p className="text-base text-[var(--clinic-powder)]">
          Sin odontograma previo de referencia.
        </p>
      )}

      {selected != null ? (
        <section className="space-y-4 rounded-lg border border-[var(--clinic-steel)]/35 bg-card p-4">
          <h2 className="font-heading text-xl font-semibold text-[var(--clinic-mint)]">
            Pieza {selected}
          </h2>

          <div>
            <Label htmlFor="estado-pieza">Estado de pieza</Label>
            <Select
              id="estado-pieza"
              value={diente?.estadoPieza ?? ""}
              disabled={pending || initial.inmutable}
              onChange={(e) => {
                const v = e.target.value as EstadoPieza | "";
                runTransition({
                  type: "set_estado_pieza",
                  piezaFdi: selected,
                  estadoPieza: v === "" ? null : v,
                });
              }}
            >
              <option value="">(no examinado / limpiar)</option>
              {ESTADOS_PIEZA.filter(Boolean).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {carasDisponibles.map((cara) => (
              <div key={cara}>
                <Label htmlFor={`cara-${cara}`}>{cara}</Label>
                <Select
                  id={`cara-${cara}`}
                  value={diente?.caras.find((c) => c.cara === cara)?.estado ?? ""}
                  disabled={pending || initial.inmutable}
                  onChange={(e) => {
                    const v = e.target.value as EstadoCara | "";
                    runTransition({
                      type: "set_cara",
                      piezaFdi: selected,
                      cara,
                      estado: v === "" ? null : v,
                    });
                  }}
                >
                  <option value="">—</option>
                  {ESTADOS_CARA.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="movilidad">
                Movilidad ({GRADO_ESCALA.id})
              </Label>
              <Select
                id="movilidad"
                value={diente?.movilidad ?? ""}
                disabled={pending || initial.inmutable}
                onChange={(e) => {
                  const v = e.target.value;
                  runTransition({
                    type: "set_movilidad",
                    piezaFdi: selected,
                    movilidad: v === "" ? null : (v as (typeof GRADO_ESCALA.valores)[number]),
                  });
                }}
              >
                <option value="">—</option>
                {GRADO_ESCALA.valores.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="recesion">Recesión</Label>
              <Select
                id="recesion"
                value={diente?.recesion ?? ""}
                disabled={pending || initial.inmutable}
                onChange={(e) => {
                  const v = e.target.value;
                  runTransition({
                    type: "set_recesion",
                    piezaFdi: selected,
                    recesion: v === "" ? null : (v as (typeof GRADO_ESCALA.valores)[number]),
                  });
                }}
              >
                <option value="">—</option>
                {GRADO_ESCALA.valores.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              defaultValue={diente?.notas ?? ""}
              disabled={pending || initial.inmutable}
              onBlur={(e) => {
                const next = e.target.value.trim() || null;
                if (next === (diente?.notas ?? null)) return;
                runTransition({
                  type: "set_notas",
                  piezaFdi: selected,
                  notas: next,
                });
              }}
            />
          </div>
        </section>
      ) : (
        <p className="text-base text-[var(--clinic-powder)]">
          Seleccione una pieza (≥48px) para editar.
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-[var(--clinic-steel)]/35 bg-card p-4">
        <h2 className="font-heading text-xl font-semibold text-[var(--clinic-mint)]">
          Tramos / prótesis
        </h2>
        <ul className="space-y-2 text-base text-[var(--clinic-mint)]">
          {tramos.map((t) => (
            <li
              key={t.id}
              className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[var(--clinic-steel)]/25 py-2"
            >
              <span>
                {t.tipo}: {t.piezasOrdenadas.join("–")}
              </span>
              <Button
                type="button"
                size="sillon"
                variant="outline"
                disabled={pending || initial.inmutable}
                onClick={() => {
                  startTransition(async () => {
                    const result = await deleteTramoAction(clinicaId, t.id);
                    if (result.ok === false) {
                      setError(result.error);
                      return;
                    }
                    setTramos((list) => list.filter((x) => x.id !== t.id));
                  });
                }}
              >
                Quitar
              </Button>
            </li>
          ))}
          {tramos.length === 0 ? (
            <li className="text-[var(--clinic-steel)]">Sin tramos</li>
          ) : null}
        </ul>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="tramo-tipo">Tipo</Label>
            <Select
              id="tramo-tipo"
              value={tramoTipo}
              onChange={(e) =>
                setTramoTipo(e.target.value as typeof tramoTipo)
              }
            >
              <option value="fija">Fija</option>
              <option value="removible">Removible</option>
              <option value="total">Total</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="tramo-piezas">Piezas contiguas (ej. 14 15 16)</Label>
            <input
              id="tramo-piezas"
              className="border-input bg-background flex h-12 w-full rounded-lg border px-3 text-base"
              value={tramoPiezas}
              onChange={(e) => setTramoPiezas(e.target.value)}
              placeholder="14 15 16"
            />
          </div>
        </div>
        <Button
          type="button"
          size="sillon"
          disabled={pending || initial.inmutable}
          onClick={onAddTramo}
        >
          Añadir tramo
        </Button>
      </section>

      {error ? <p className="text-destructive text-base">{error}</p> : null}
    </div>
  );
}
