"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth/client";

export function SignOutLink({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await authClient.signOut({});
          router.push("/login");
          router.refresh();
        });
      }}
    >
      {pending ? "Saliendo…" : "Salir / otro perfil"}
    </button>
  );
}
