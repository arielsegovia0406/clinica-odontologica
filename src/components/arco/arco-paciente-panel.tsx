"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  crearSolicitudArcoAction,
  listSolicitudesPacienteAction,
  type SolicitudArcoItem,
} from "@/app/app/[clinicaId]/arco/actions";

type Props = {
  clinicaId: string;
  pacienteId: string;
  canSolicitar: boolean;
  retencionHasta: Date | null;
  initialSolicitudes: SolicitudArcoItem[];
};

export function ArcoPacientePanel({
  clinicaId,
  pacienteId,
  canSolicitar,
  retencionHasta,
  initialSolicitudes,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialSolicitudes);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const listed = await listSolicitudesPacienteAction(clinicaId, pacienteId);
      if (listed.ok) setItems(listed.data.solicitudes);
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-[var(--clinic-steel)]/35 bg-card p-4">
      <div>
        <h2 className="font-heading text-xl text-[var(--clinic-mint)]">
          Derechos ARCO
        </h2>
        <p className="text-sm text-[var(--clinic-steel)]">
          Solicitudes de exportación o eliminación. Requieren aprobación de
          admin. Ver docs/ARCO.md
        </p>
        {retencionHasta ? (
          <p className="mt-1 text-sm text-[var(--clinic-powder)]">
            Retención hasta{" "}
            <strong className="text-[var(--clinic-aqua)]">
              {new Date(retencionHasta).toISOString().slice(0, 10)}
            </strong>
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--clinic-powder)]">
            Sin retencion_hasta (plazos legales pendientes de confirmación).
          </p>
        )}
      </div>

      {canSolicitar ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            size="sillon"
            disabled={pending}
            onClick={() => {
              setError(null);
              setMsg(null);
              startTransition(async () => {
                const result = await crearSolicitudArcoAction(
                  clinicaId,
                  pacienteId,
                  "exportacion",
                );
                if (result.ok === false) {
                  setError(result.error);
                  return;
                }
                setMsg("Solicitud de exportación creada");
                refresh();
              });
            }}
          >
            Solicitar exportación
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sillon"
            disabled={pending}
            onClick={() => {
              setError(null);
              setMsg(null);
              startTransition(async () => {
                const result = await crearSolicitudArcoAction(
                  clinicaId,
                  pacienteId,
                  "eliminacion",
                );
                if (result.ok === false) {
                  setError(result.error);
                  return;
                }
                setMsg("Solicitud de eliminación creada (pendiente admin)");
                refresh();
              });
            }}
          >
            Solicitar eliminación
          </Button>
        </div>
      ) : null}

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

      <ul className="space-y-2 text-sm">
        {items.length === 0 ? (
          <li className="text-[var(--clinic-steel)]">Sin solicitudes.</li>
        ) : (
          items.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--clinic-steel)]/20 pb-2"
            >
              <span>
                {s.tipo} ·{" "}
                <span className="text-[var(--clinic-aqua)]">{s.estado}</span>
              </span>
              <span className="text-[var(--clinic-steel)]">
                {new Date(s.solicitadoEn).toISOString().slice(0, 10)}
                {s.resultadoRuta ? (
                  <>
                    {" · "}
                    <a
                      className="text-[var(--clinic-mint)] underline-offset-4 hover:underline"
                      href={`/api/clinica/${clinicaId}/arco/${s.id}/export`}
                    >
                      Descargar JSON
                    </a>
                  </>
                ) : null}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
