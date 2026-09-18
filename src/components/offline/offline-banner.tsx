"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useOffline } from "next/offline";
import { Button } from "@/components/ui/button";
import { countPendingMutations } from "@/lib/offline/queue";
import { flushOfflineQueue } from "@/lib/offline/sync";

type Props = { clinicaId: string };

export function OfflineBanner({ clinicaId }: Props) {
  const offline = useOffline();
  const wasOffline = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const refreshCount = useCallback(async () => {
    try {
      const n = await countPendingMutations(clinicaId);
      setPendingCount(n);
    } catch {
      setPendingCount(0);
    }
  }, [clinicaId]);

  const runFlush = useCallback(() => {
    startTransition(async () => {
      setError(null);
      setMsg(null);
      const result = await flushOfflineQueue(clinicaId);
      await refreshCount();
      if (result.synced > 0) {
        setMsg(`Sincronizados ${result.synced} cambio(s) local(es)`);
      }
      if (result.failed > 0) {
        setError(result.errors[0] ?? "Algunos cambios no sincronizaron");
      }
    });
  }, [clinicaId, refreshCount]);

  useEffect(() => {
    void refreshCount();
    const onFocus = () => void refreshCount();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [refreshCount]);

  useEffect(() => {
    if (wasOffline.current && !offline) {
      void refreshCount().then(() => runFlush());
    }
    wasOffline.current = offline;
  }, [offline, refreshCount, runFlush]);

  if (!offline && pendingCount === 0 && !msg && !error) return null;

  return (
    <div
      className="mb-4 space-y-2 rounded-lg border border-[var(--clinic-cyan)]/40 bg-[var(--clinic-steel)]/10 px-4 py-3 text-sm"
      role="status"
    >
      {offline ? (
        <p className="text-[var(--clinic-powder)]">
          Sin conexión — los cambios del odontograma se guardan en este
          dispositivo (Dexie) hasta sincronizar.
        </p>
      ) : null}
      {pendingCount > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[var(--clinic-aqua)]">
            {pendingCount} cambio(s) pendiente(s) de sincronizar
          </p>
          <Button
            type="button"
            size="sm"
            disabled={busy || offline}
            onClick={() => runFlush()}
          >
            Sincronizar
          </Button>
        </div>
      ) : null}
      {msg ? <p className="text-[var(--clinic-mint)]">{msg}</p> : null}
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
