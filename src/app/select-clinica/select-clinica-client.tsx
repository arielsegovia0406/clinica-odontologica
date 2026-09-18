"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

type Clinica = {
  id: string;
  name: string;
  role: string;
  inactividadMinutos: number;
};

export function SelectClinicaClient({ clinicas }: { clinicas: Clinica[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(clinicaId: string) {
    setLoadingId(clinicaId);
    setError(null);
    const res = await fetch("/api/clinica/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicaId }),
    });
    setLoadingId(null);
    if (!res.ok) {
      setError("No se pudo seleccionar la clínica");
      return;
    }
    router.push(`/app/${clinicaId}`);
    router.refresh();
  }

  return (
    <div className="border-border bg-card w-full max-w-lg space-y-4 rounded-xl border p-8 shadow-[0_0_0_1px_var(--clinic-steel)]/20">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--clinic-mint)]">
        Seleccione clínica
      </h1>
      <p className="text-muted-foreground">
        El rol depende de su membresía en cada clínica. Use otro perfil demo en
        login para probar auxiliar / admin.
      </p>
      <ul className="space-y-3">
        {clinicas.map((c) => (
          <li key={c.id}>
            <Button
              type="button"
              variant="outline"
              className="border-[var(--clinic-steel)]/50 h-16 w-full justify-between px-4 text-left text-lg hover:border-[var(--clinic-cyan)] hover:bg-[var(--clinic-navy)]/40"
              disabled={loadingId === c.id}
              onClick={() => void choose(c.id)}
            >
              <span className="text-foreground">{c.name}</span>
              <span className="text-[var(--clinic-aqua)] text-sm">{c.role}</span>
            </Button>
          </li>
        ))}
      </ul>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button
        type="button"
        variant="ghost"
        size="sillon"
        className="w-full text-[var(--clinic-powder)]"
        onClick={() =>
          void authClient.signOut({}).then(() => {
            router.push("/login");
            router.refresh();
          })
        }
      >
        Cambiar de usuario
      </Button>
    </div>
  );
}
