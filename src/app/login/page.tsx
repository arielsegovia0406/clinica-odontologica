import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/select-clinica");

  return (
    <main className="bg-background flex min-h-full flex-1 items-center justify-center p-6">
      <div className="border-border bg-card w-full max-w-lg rounded-xl border shadow-[0_0_0_1px_color-mix(in_srgb,#84bac9_20%,transparent)]">
        <LoginForm />
      </div>
    </main>
  );
}
