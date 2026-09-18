import { redirect } from "next/navigation";

type Props = { params: Promise<{ clinicaId: string }> };

export default async function ClinicaHomeRedirect({ params }: Props) {
  const { clinicaId } = await params;
  redirect(`/app/${clinicaId}/pacientes`);
}
