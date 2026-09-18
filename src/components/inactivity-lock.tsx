"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  inactivityMinutes: number;
  children: React.ReactNode;
};

/**
 * Clinic workstation lock: short inactivity → PIN gate.
 * Does not sign out / destroy session or in-memory drafts.
 */
export function InactivityLock({ inactivityMinutes, children }: Props) {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (locked) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setLocked(true),
      Math.max(1, inactivityMinutes) * 60_000,
    );
  }, [inactivityMinutes, locked]);

  useEffect(() => {
    const events = ["pointerdown", "keydown", "mousemove", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, resetTimer);
    resetTimer();
    return () => {
      for (const e of events) window.removeEventListener(e, resetTimer);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [resetTimer]);

  async function unlock() {
    setError(null);
    const res = await fetch("/api/auth/unlock-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      setError("PIN incorrecto");
      return;
    }
    setPin("");
    setLocked(false);
    resetTimer();
  }

  return (
    <>
      {children}
      {locked ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Sesión bloqueada por inactividad"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg bg-background p-8 shadow-lg">
            <h2 className="text-2xl font-semibold tracking-tight">
              Sesión bloqueada
            </h2>
            <p className="text-muted-foreground text-base">
              Ingrese su PIN para continuar. La consulta en curso no se pierde.
            </p>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="h-14 w-full rounded-md border px-4 text-2xl tracking-widest"
              placeholder="••••"
              aria-label="PIN"
            />
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button
              type="button"
              className="h-14 w-full text-lg"
              onClick={() => void unlock()}
            >
              Desbloquear
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
