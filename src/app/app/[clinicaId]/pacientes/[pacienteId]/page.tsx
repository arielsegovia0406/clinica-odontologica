import Link from "next/link";
import { notFound } from "next/navigation";
import { AnamnesisPanel } from "@/components/pacientes/anamnesis-panel";
import { ConsentimientosPanel } from "@/components/pacientes/consentimientos-panel";
import { VisitaSignosPanel } from "@/components/pacientes/visita-signos-panel";
import { DocumentosPanel } from "@/components/documentos/documentos-panel";
import { ArcoPacientePanel } from "@/components/arco/arco-paciente-panel";
import { loadPacienteFicha } from "@/app/app/[clinicaId]/pacientes/actions";
import { listDocumentosVisitaAction } from "@/app/app/[clinicaId]/pacientes/[pacienteId]/documentos/actions";
import { listSolicitudesPacienteAction } from "@/app/app/[clinicaId]/arco/actions";
import { requireClinicContext, hasCapability } from "@/lib/auth/clinic-context";

type Props = { params: Promise<{ clinicaId: string; pacienteId: string }> };

export default async function PacienteFichaPage({ params }: Props) {
  const { clinicaId, pacienteId } = await params;
  const ctx = await requireClinicContext(clinicaId);
  const ficha = await loadPacienteFicha(clinicaId, pacienteId);
  if (!ficha) notFound();

  const docsResult = await listDocumentosVisitaAction(clinicaId, pacienteId);
  const docsData =
    docsResult.ok === true
      ? docsResult.data
      : { visitaId: null, estadoVisita: null, documentos: [] };

  const arcoResult = await listSolicitudesPacienteAction(clinicaId, pacienteId);
  const arcoItems = arcoResult.ok ? arcoResult.data.solicitudes : [];

  const { paciente } = ficha;

  return (
    <main className="flex flex-col gap-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/app/${clinicaId}/pacientes`}
            className="text-muted-foreground text-base underline-offset-4 hover:underline"
          >
            ← Pacientes
          </Link>
          <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-[var(--clinic-mint)]">
            {paciente.apellidos}, {paciente.nombres}
          </h1>
          <p className="text-muted-foreground text-base">
            {paciente.tipoDocumento} {paciente.numeroDocumento}
            {paciente.numeroArchivo ? ` · Archivo ${paciente.numeroArchivo}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/app/${clinicaId}/pacientes/${pacienteId}/editar`}
            className="border-border inline-flex h-12 min-w-36 items-center justify-center rounded-lg border px-4 text-base font-medium"
          >
            Editar
          </Link>
          <Link
            href={`/app/${clinicaId}/pacientes/${pacienteId}/odontograma`}
            className="bg-primary text-primary-foreground inline-flex h-12 min-w-36 items-center justify-center rounded-lg px-4 text-base font-medium"
          >
            Odontograma
          </Link>
          <Link
            href={`/app/${clinicaId}/pacientes/${pacienteId}/indices`}
            className="border-[var(--clinic-cyan)]/50 text-[var(--clinic-mint)] inline-flex h-12 min-w-36 items-center justify-center rounded-lg border px-4 text-base font-medium"
          >
            Índices
          </Link>
          <Link
            href={`/app/${clinicaId}/pacientes/${pacienteId}/dictado`}
            className="border-[var(--clinic-sky)]/50 text-[var(--clinic-powder)] inline-flex h-12 min-w-36 items-center justify-center rounded-lg border px-4 text-base font-medium"
          >
            Dictado
          </Link>
        </div>
      </div>

      <section className="grid gap-2 text-base sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Nacimiento: </span>
          {paciente.fechaNacimiento.toISOString().slice(0, 10)}
        </p>
        <p>
          <span className="text-muted-foreground">Sexo: </span>
          {paciente.sexo}
        </p>
        <p>
          <span className="text-muted-foreground">Teléfono: </span>
          {paciente.telefono || "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Email: </span>
          {paciente.email || "—"}
        </p>
        <p className="sm:col-span-2">
          <span className="text-muted-foreground">Dirección: </span>
          {paciente.direccion || "—"}
        </p>
      </section>

      <ConsentimientosPanel
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        catalog={ficha.consentCatalog}
        consents={ficha.consents}
        hasTratamientoDatos={ficha.hasTratamientoDatos}
        hasGrabacionAudio={ficha.hasGrabacionAudio}
      />

      <AnamnesisPanel
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        canRead={ficha.canReadAnamnesis}
        canWrite={ficha.canWriteAnamnesis}
        anamnesisExists={ficha.anamnesisExists}
        anamnesisCount={ficha.anamnesisCount}
        versions={ficha.anamnesisVersions}
        hasTratamientoDatos={ficha.hasTratamientoDatos}
      />

      <VisitaSignosPanel
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        hasTratamientoDatos={ficha.hasTratamientoDatos}
        hasGrabacionAudio={ficha.hasGrabacionAudio}
        visitaBorrador={ficha.visitaBorrador}
      />

      <DocumentosPanel
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        canFirmar={hasCapability(ctx, "documento_firmar")}
        estadoVisita={docsData.estadoVisita}
        visitaId={docsData.visitaId}
        initialDocs={docsData.documentos}
      />

      <ArcoPacientePanel
        clinicaId={clinicaId}
        pacienteId={pacienteId}
        canSolicitar={hasCapability(ctx, "arco_solicitar")}
        retencionHasta={paciente.retencionHasta}
        initialSolicitudes={arcoItems}
      />
    </main>
  );
}
