"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = { clinicaId: string; initialQ: string };

export function PacienteSearch({ clinicaId, initialQ }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-wrap gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => {
          const params = new URLSearchParams(searchParams.toString());
          if (q.trim()) params.set("q", q.trim());
          else params.delete("q");
          router.push(`/app/${clinicaId}/pacientes?${params.toString()}`);
        });
      }}
    >
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, documento o archivo"
        className="max-w-md"
        aria-label="Buscar pacientes"
      />
      <Button type="submit" size="sillon" disabled={pending}>
        Buscar
      </Button>
    </form>
  );
}
