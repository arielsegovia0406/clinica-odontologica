"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

const DEMO_PROFILES = [
  { email: "odontologo@demo.local", label: "Odontólogo", role: "odontologo" },
  { email: "auxiliar@demo.local", label: "Auxiliar", role: "auxiliar" },
  { email: "admin@demo.local", label: "Admin", role: "admin" },
  { email: "multi@demo.local", label: "Multi-clínica", role: "odontologo" },
] as const;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("odontologo@demo.local");
  const [password, setPassword] = useState("Demo1234!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(nextEmail: string) {
    setLoading(true);
    setError(null);
    setEmail(nextEmail);
    const { error: err } = await authClient.signIn.email({
      email: nextEmail,
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? "No se pudo iniciar sesión");
      return;
    }
    router.push("/select-clinica");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await signIn(email);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-md space-y-5 p-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-[var(--clinic-mint)]">
          Historia clínica odontológica
        </h1>
        <p className="text-muted-foreground mt-2 text-base">
          Inicie sesión con su cuenta de clínica
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--clinic-aqua)]">
          Perfiles demo (un toque)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO_PROFILES.map((p) => (
            <Button
              key={p.email}
              type="button"
              variant="outline"
              size="sillon"
              className="justify-start border-[var(--clinic-steel)]/40 text-left"
              disabled={loading}
              onClick={() => void signIn(p.email)}
            >
              <span className="flex flex-col items-start">
                <span>{p.label}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {p.role}
                </span>
              </span>
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Contraseña demo: Demo1234! · PIN: 1234
        </p>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-medium">Correo</span>
        <input
          className="border-input bg-background text-foreground focus-visible:ring-[var(--clinic-cyan)]/40 h-12 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium">Contraseña</span>
        <input
          className="border-input bg-background text-foreground focus-visible:ring-[var(--clinic-cyan)]/40 h-12 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-3"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button
        type="submit"
        size="sillon"
        className="w-full bg-[var(--clinic-cyan)] text-black hover:bg-[var(--clinic-aqua)]"
        disabled={loading}
      >
        {loading ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
