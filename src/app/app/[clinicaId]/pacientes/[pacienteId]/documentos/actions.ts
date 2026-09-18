"use server";

import { and, desc, eq } from "drizzle-orm";
import {
  requireCapability,
  requireClinicContext,
} from "@/lib/auth/clinic-context";
import { canStartClinicalCare } from "@/lib/clinical/consent-rules";
import {
  buildForm033SummaryPdf,
  diagnosticosForPdf,
} from "@/lib/documents/form-033-summary";
import { saveDocumentPdf } from "@/lib/documents/storage";
import { writeAudit } from "@/lib/db/audit";
import {
  consentimientos,
  diagnosticos,
  documentosGenerados,
  indices,
  odontogramaCaras,
  odontogramaDientes,
  odontogramas,
  organization,
  pacientes,
  visitas,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/with-tenant";
import { newId } from "@/lib/ids";
import { DrawnSignatureProvider } from "@/lib/signatures/provider";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type DocumentoListItem = {
  id: string;
  tipo: string;
  generadoEn: Date;
  contentHash: string;
  rutaStorage: string;
};

export async function listDocumentosVisitaAction(
  clinicaId: string,
  pacienteId: string,
): Promise<
  ActionResult<{
    visitaId: string | null;
    estadoVisita: string | null;
    documentos: DocumentoListItem[];
  }>
> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "documento_read");

  try {
    const data = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const draftOrLatest = await tx
          .select()
          .from(visitas)
          .where(eq(visitas.pacienteId, pacienteId))
          .orderBy(desc(visitas.createdAt))
          .limit(1);
        const visita = draftOrLatest[0] ?? null;
        if (!visita) {
          return { visitaId: null, estadoVisita: null, documentos: [] };
        }
        const docs = await tx
          .select({
            id: documentosGenerados.id,
            tipo: documentosGenerados.tipo,
            generadoEn: documentosGenerados.generadoEn,
            contentHash: documentosGenerados.contentHash,
            rutaStorage: documentosGenerados.rutaStorage,
          })
          .from(documentosGenerados)
          .where(eq(documentosGenerados.visitaId, visita.id))
          .orderBy(desc(documentosGenerados.generadoEn));
        return {
          visitaId: visita.id,
          estadoVisita: visita.estado,
          documentos: docs,
        };
      },
    );
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al listar documentos",
    };
  }
}

export async function firmarYGenerar033Action(
  clinicaId: string,
  pacienteId: string,
): Promise<ActionResult<{ documentoId: string; visitaId: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "documento_firmar");

  try {
    const result = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const consents = await tx
          .select({
            tipo: consentimientos.tipo,
            versionTexto: consentimientos.versionTexto,
            aceptadoEn: consentimientos.aceptadoEn,
            revocadoEn: consentimientos.revocadoEn,
          })
          .from(consentimientos)
          .where(eq(consentimientos.pacienteId, pacienteId));
        if (!canStartClinicalCare(consents)) {
          throw new Error(
            "Se requiere consentimiento vigente de tratamiento de datos",
          );
        }

        const visitaRows = await tx
          .select()
          .from(visitas)
          .where(
            and(
              eq(visitas.pacienteId, pacienteId),
              eq(visitas.estado, "borrador"),
            ),
          )
          .orderBy(desc(visitas.createdAt))
          .limit(1);
        const visita = visitaRows[0];
        if (!visita) {
          throw new Error("No hay visita en borrador para firmar");
        }

        const pac = (
          await tx
            .select()
            .from(pacientes)
            .where(eq(pacientes.id, pacienteId))
            .limit(1)
        )[0];
        if (!pac) throw new Error("Paciente no encontrado");

        const org = (
          await tx
            .select({ name: organization.name })
            .from(organization)
            .where(eq(organization.id, clinicaId))
            .limit(1)
        )[0];

        const odo = (
          await tx
            .select()
            .from(odontogramas)
            .where(eq(odontogramas.visitaId, visita.id))
            .limit(1)
        )[0];

        const odontogramaResumen: string[] = [];
        if (odo) {
          const dientes = await tx
            .select()
            .from(odontogramaDientes)
            .where(eq(odontogramaDientes.odontogramaId, odo.id));
          for (const d of dientes) {
            if (d.estadoPieza) {
              odontogramaResumen.push(`FDI ${d.piezaFdi}: ${d.estadoPieza}`);
            }
            const caras = await tx
              .select()
              .from(odontogramaCaras)
              .where(eq(odontogramaCaras.dienteId, d.id));
            for (const c of caras) {
              odontogramaResumen.push(
                `FDI ${d.piezaFdi} ${c.cara}: ${c.estado}`,
              );
            }
          }
        }

        const idx = (
          await tx
            .select()
            .from(indices)
            .where(eq(indices.visitaId, visita.id))
            .limit(1)
        )[0];

        const diags = await tx
          .select()
          .from(diagnosticos)
          .where(
            and(
              eq(diagnosticos.visitaId, visita.id),
              eq(diagnosticos.confirmado, true),
            ),
          );

        // Sign content hash of a provisional buffer first after build
        const signer = new DrawnSignatureProvider();
        const firmadoEn = new Date();

        const pdfInputBase = {
          clinicaNombre: org?.name ?? clinicaId,
          paciente: {
            nombres: pac.nombres,
            apellidos: pac.apellidos,
            tipoDocumento: pac.tipoDocumento,
            numeroDocumento: pac.numeroDocumento,
            fechaNacimiento: pac.fechaNacimiento.toISOString().slice(0, 10),
            sexo: pac.sexo,
          },
          visita: {
            id: visita.id,
            motivoConsulta: visita.motivoConsulta,
            enfermedadActual: visita.enfermedadActual,
            signosVitales: visita.signosVitales,
            denticion: odo?.denticion ?? visita.denticionForzada,
          },
          odontogramaResumen,
          indices: idx
            ? {
                cpoD: idx.cpoD,
                ceoD: idx.ceoD,
                ihosPlaca: idx.ihosPlaca,
                ihosCalculo: idx.ihosCalculo,
              }
            : null,
          consentimientos: consents
            .filter((c) => c.revocadoEn == null)
            .map((c) => ({
              tipo: c.tipo,
              version: c.versionTexto,
              aceptadoEn: c.aceptadoEn.toISOString(),
            })),
          diagnosticos: diagnosticosForPdf(diags),
        };

        // Build once with placeholder firma, hash, then rebuild with real referencia
        const placeholderPdf = await buildForm033SummaryPdf({
          ...pdfInputBase,
          firma: {
            profesionalNombre: ctx.userName,
            rol: ctx.role,
            tipo: signer.tipo,
            referencia: "pending",
            firmadoEn: firmadoEn.toISOString(),
          },
        });
        const { createHash } = await import("node:crypto");
        const contentHashPreview = createHash("sha256")
          .update(placeholderPdf)
          .digest("hex");
        const signature = await signer.sign({
          visitaId: visita.id,
          userId: ctx.userId,
          contentHash: contentHashPreview,
        });

        const pdf = await buildForm033SummaryPdf({
          ...pdfInputBase,
          firma: {
            profesionalNombre: ctx.userName,
            rol: ctx.role,
            tipo: signature.tipo,
            referencia: signature.referencia,
            firmadoEn: signature.firmadoEn.toISOString(),
          },
        });

        const stored = await saveDocumentPdf({
          clinicaId: ctx.clinicaId,
          visitaId: visita.id,
          tipo: "form_033",
          pdf,
        });

        // Lock odontograma via visita estado (DB trigger sets inmutable)
        await tx
          .update(visitas)
          .set({
            estado: "firmada",
            firmadaEn: signature.firmadoEn,
            firmaTipo: signature.tipo,
            firmaReferencia: signature.referencia,
            updatedAt: new Date(),
          })
          .where(eq(visitas.id, visita.id));

        const documentoId = newId("doc");
        await tx.insert(documentosGenerados).values({
          id: documentoId,
          clinicaId: ctx.clinicaId,
          visitaId: visita.id,
          tipo: "form_033",
          rutaStorage: stored.rutaStorage,
          contentHash: stored.contentHash,
          generadoPor: ctx.userId,
        });

        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "firmar_generar_033",
          entidad: "documentos_generados",
          entidadId: documentoId,
          valorNuevo: {
            visitaId: visita.id,
            contentHash: stored.contentHash,
            firma: signature.referencia,
          },
        });

        return { documentoId, visitaId: visita.id };
      },
    );
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al firmar / generar PDF",
    };
  }
}
