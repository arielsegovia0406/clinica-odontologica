"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  aprobarSolicitudArcoAction,
  ejecutarEliminacionArcoAction,
  ejecutarExportacionArcoAction,
  listSolicitudesClinicaAction,
  rechazarSolicitudArcoAction,
  type SolicitudArcoItem,
} from "@/app/app/[clinicaId]/arco/actions";
import { isRetencionVigente } from "@/lib/clinical/arco";

type Props = {
  clinicaId: string;
  initialSolicitudes: SolicitudArcoItem[];
};

export function ArcoAdminPanel({ clinicaId, initialSolicitudes }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialSolicitudes);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const listed = await listSolicitudesClinicaAction(clinicaId);
      if (listed.ok) setItems(listed.data.solicitudes);
      router.refresh();
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--clinic-mint)]">
          Solicitudes ARCO
        </h1>
        <p className="text-muted-foreground mt-1 text-base">
          Aprobar, rechazar o ejecutar exportaciones y eliminaciones.
        </p>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-[var(--clinic-mint)]" role="status">
          {msg}
        </p>
      ) : null}

      <ul className="space-y-4">
        {items.length === 0 ? (
          <li className="text-[var(--clinic-steel)]">No hay solicitudes.</li>
        ) : (
          items.map((s) => {
            const hold = isRetencionVigente(s.retencionHasta);
            return (
              <li
                key={s.id}
                className="space-y-3 rounded-xl border border-[var(--clinic-steel)]/35 bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[var(--clinic-powder)]">
                      {s.pacienteLabel}
                    </p>
                    <p className="text-sm text-[var(--clinic-steel)]">
                      {s.tipo} ·{" "}
                      <span className="text-[var(--clinic-aqua)]">
                        {s.estado}
                      </span>{" "}
                      · {new Date(s.solicitadoEn).toISOString().slice(0, 10)}
                    </p>
                    {s.tipo === "eliminacion" && hold ? (
                      <p className="mt-1 text-sm text-amber-200/90">
                        Retención vigente hasta{" "}
                        {new Date(s.retencionHasta!).toISOString().slice(0, 10)}{" "}
                        — no ejecutar eliminación.
                      </p>
                    ) : null}
                  </div>
                  {s.resultadoRuta ? (
                    <a
                      className="text-[var(--clinic-mint)] text-sm underline-offset-4 hover:underline"
                      href={`/api/clinica/${clinicaId}/arco/${s.id}/export`}
                    >
                      Descargar JSON
                    </a>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {s.estado === "solicitada" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setMsg(null);
                          startTransition(async () => {
                            const r = await aprobarSolicitudArcoAction(
                              clinicaId,
                              s.id,
                            );
                            if (r.ok === false) {
                              setError(r.error);
                              return;
                            }
                            setMsg("Solicitud aprobada");
                            refresh();
                          });
                        }}
                      >
                        Aprobar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setError(null);
                          setMsg(null);
                          startTransition(async () => {
                            const r = await rechazarSolicitudArcoAction(
                              clinicaId,
                              s.id,
                            );
                            if (r.ok === false) {
                              setError(r.error);
                              return;
                            }
                            setMsg("Solicitud rechazada");
                            refresh();
                          });
                        }}
                      >
                        Rechazar
                      </Button>
                    </>
                  ) : null}

                  {s.estado === "aprobada_admin" && s.tipo === "exportacion" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        setMsg(null);
                        startTransition(async () => {
                          const r = await ejecutarExportacionArcoAction(
                            clinicaId,
                            s.id,
                          );
                          if (r.ok === false) {
                            setError(r.error);
                            return;
                          }
                          setMsg("Exportación generada");
                          refresh();
                        });
                      }}
                    >
                      Ejecutar exportación
                    </Button>
                  ) : null}

                  {s.estado === "aprobada_admin" && s.tipo === "eliminacion" ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pending || hold}
                      onClick={() => {
                        setError(null);
                        setMsg(null);
                        startTransition(async () => {
                          const r = await ejecutarEliminacionArcoAction(
                            clinicaId,
                            s.id,
                          );
                          if (r.ok === false) {
                            setError(r.error);
                            return;
                          }
                          setMsg(
                            `Eliminación ejecutada (${r.data.visitasEliminadas} visitas)`,
                          );
                          refresh();
                        });
                      }}
                    >
                      Ejecutar eliminación
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
