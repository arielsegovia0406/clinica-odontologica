import Link from "next/link";
import { InactivityLock } from "@/components/inactivity-lock";
import { SignOutLink } from "@/components/sign-out-link";
import { OfflineBanner } from "@/components/offline/offline-banner";
import { requireClinicContext } from "@/lib/auth/clinic-context";

type Props = {
  children: React.ReactNode;
  params: Promise<{ clinicaId: string }>;
};

export default async function ClinicaLayout({ children, params }: Props) {
  const { clinicaId } = await params;
  const ctx = await requireClinicContext(clinicaId);

  return (
    <InactivityLock inactivityMinutes={ctx.inactividadMinutos}>
      <div className="bg-background text-foreground flex min-h-full flex-1 flex-col">
        <header className="border-border border-b border-[var(--clinic-steel)]/20">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div>
              <p className="font-heading text-2xl font-semibold tracking-tight text-[var(--clinic-mint)]">
                {ctx.clinicaName}
              </p>
              <p className="text-muted-foreground text-base">
                {ctx.userName} ·{" "}
                <span className="text-[var(--clinic-aqua)]">{ctx.role}</span>
              </p>
            </div>
            <nav className="flex flex-wrap gap-3">
              <Link
                href={`/app/${clinicaId}/pacientes`}
                className="border-border inline-flex h-12 min-w-36 items-center justify-center rounded-lg border px-4 text-base font-medium hover:border-[var(--clinic-cyan)]"
              >
                Pacientes
              </Link>
              {ctx.role === "admin" ? (
                <Link
                  href={`/app/${clinicaId}/arco`}
                  className="border-[var(--clinic-cyan)]/50 text-[var(--clinic-mint)] inline-flex h-12 min-w-36 items-center justify-center rounded-lg border px-4 text-base font-medium"
                >
                  ARCO
                </Link>
              ) : null}
              <Link
                href="/select-clinica?elegir=1"
                className="border-border text-muted-foreground inline-flex h-12 min-w-36 items-center justify-center rounded-lg border px-4 text-base"
              >
                Cambiar clínica
              </Link>
              <SignOutLink className="text-[var(--clinic-powder)] inline-flex h-12 min-w-36 items-center justify-center rounded-lg px-4 text-base underline-offset-4 hover:underline disabled:opacity-50" />
            </nav>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
          <OfflineBanner clinicaId={clinicaId} />
          {children}
        </div>
      </div>
    </InactivityLock>
  );
}
