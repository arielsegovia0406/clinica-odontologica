import { notFound } from "next/navigation";
import { ArcoAdminPanel } from "@/components/arco/arco-admin-panel";
import { listSolicitudesClinicaAction } from "@/app/app/[clinicaId]/arco/actions";
import { hasCapability, requireClinicContext } from "@/lib/auth/clinic-context";

type Props = { params: Promise<{ clinicaId: string }> };

export default async function ArcoAdminPage({ params }: Props) {
  const { clinicaId } = await params;
  const ctx = await requireClinicContext(clinicaId);
  if (!hasCapability(ctx, "arco_admin")) notFound();

  const listed = await listSolicitudesClinicaAction(clinicaId);
  const solicitudes = listed.ok ? listed.data.solicitudes : [];

  return (
    <main>
      <ArcoAdminPanel clinicaId={clinicaId} initialSolicitudes={solicitudes} />
    </main>
  );
}
