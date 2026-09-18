"use server";

import { and, desc, eq } from "drizzle-orm";
import {
  requireCapability,
  requireClinicContext,
} from "@/lib/auth/clinic-context";
import { getClinicalExtractor, getTranscriptionProvider, sttConfigured } from "@/lib/ai/providers";
import type { ClinicalExtraction } from "@/lib/ai/clinical-extractor";
import { canEnableDictado, canStartClinicalCare } from "@/lib/clinical/consent-rules";
import {
  mapExtractionToProposals,
  type MappedProposal,
} from "@/lib/clinical/dictado-mapper";
import { sugerirDenticionPorEdad } from "@/lib/clinical/odontograma-config";
import type { Denticion } from "@/lib/clinical/odontograma";
import { writeAudit } from "@/lib/db/audit";
import {
  consentimientos,
  odontogramas,
  organization,
  pacientes,
  sesionesDictado,
  visitas,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/with-tenant";
import { newId } from "@/lib/ids";
import { applyOdontogramaTransitionAction } from "@/app/app/[clinicaId]/pacientes/[pacienteId]/odontograma/actions";
import type { Transition } from "@/lib/clinical/odontograma";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type DictadoSessionPayload = {
  sesionId: string;
  transcripcion: string;
  extraction: ClinicalExtraction;
  proposals: MappedProposal[];
  modeloStt: string | null;
  modeloLlm: string;
  latenciaMs: number;
  sttConfigured: boolean;
  odontogramaId: string;
  visitaId: string;
};

function ageYears(born: Date): number {
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const m = now.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

async function assertDictadoAllowed(
  clinicaId: string,
  pacienteId: string,
) {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "dictado_use");

  return withTenant(
    { clinicaId: ctx.clinicaId, userId: ctx.userId },
    async (tx) => {
      const consents = await tx
        .select({
          tipo: consentimientos.tipo,
          revocadoEn: consentimientos.revocadoEn,
          aceptadoEn: consentimientos.aceptadoEn,
        })
        .from(consentimientos)
        .where(eq(consentimientos.pacienteId, pacienteId));

      if (!canStartClinicalCare(consents)) {
        throw new Error(
          "Se requiere consentimiento vigente de tratamiento de datos",
        );
      }
      if (!canEnableDictado(consents)) {
        throw new Error(
          "Se requiere consentimiento vigente de grabación de audio",
        );
      }

      const org = await tx
        .select({ retenerAudio: organization.retenerAudio })
        .from(organization)
        .where(eq(organization.id, clinicaId))
        .limit(1);

      const draft = await tx
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
      if (!draft[0]) {
        throw new Error("No hay visita en borrador — inicie atención primero");
      }

      let odo = await tx
        .select()
        .from(odontogramas)
        .where(eq(odontogramas.visitaId, draft[0].id))
        .limit(1);

      const pac = await tx
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);
      if (!pac[0]) throw new Error("Paciente no encontrado");

      const sugerida = sugerirDenticionPorEdad(ageYears(pac[0].fechaNacimiento));
      const denticion = (draft[0].denticionForzada ?? sugerida) as Denticion;

      if (!odo[0]) {
        const id = newId("odo");
        await tx.insert(odontogramas).values({
          id,
          clinicaId: ctx.clinicaId,
          visitaId: draft[0].id,
          denticion,
          capturadoPor: ctx.userId,
          responsableId: ctx.role === "odontologo" ? ctx.memberId : null,
          inmutable: false,
        });
        odo = await tx
          .select()
          .from(odontogramas)
          .where(eq(odontogramas.id, id))
          .limit(1);
      }

      if (odo[0]!.inmutable) {
        throw new Error("Odontograma inmutable; no se puede dictar");
      }

      return {
        ctx,
        visita: draft[0],
        odontograma: odo[0]!,
        paciente: pac[0],
        denticion: odo[0]!.denticion as Denticion,
        retenerAudio: org[0]?.retenerAudio ?? false,
      };
    },
  );
}

export async function processDictadoAction(
  clinicaId: string,
  pacienteId: string,
  input: {
    transcript?: string;
    /** base64 audio webm when STT is configured */
    audioBase64?: string;
    audioMimeType?: string;
  },
): Promise<ActionResult<DictadoSessionPayload>> {
  try {
    const gate = await assertDictadoAllowed(clinicaId, pacienteId);
    const started = Date.now();

    let transcript = input.transcript?.trim() ?? "";
    let modeloStt: string | null = null;
    let sttMs = 0;

    if ((!transcript || transcript.length < 2) && input.audioBase64) {
      if (!sttConfigured()) {
        return {
          ok: false,
          error:
            "No hay STT configurado. Pegue/dicte texto, o defina OPENAI_API_KEY / STT_API_KEY.",
        };
      }
      const bin = Buffer.from(input.audioBase64, "base64");
      const blob = new Blob([bin], {
        type: input.audioMimeType ?? "audio/webm",
      });
      const stt = getTranscriptionProvider();
      const result = await stt.transcribe(blob, "es");
      transcript = result.text.trim();
      modeloStt = result.model;
      sttMs = result.latencyMs;
    }

    if (transcript.length < 2) {
      return {
        ok: false,
        error: "Transcripción vacía. Dicte o escriba hallazgos explícitos.",
      };
    }

    const extractor = getClinicalExtractor();
    const extractStarted = Date.now();
    const extraction = await extractor.extract({
      transcription: transcript,
      patientAgeYears: ageYears(gate.paciente.fechaNacimiento),
      denticion: gate.denticion,
    });
    const extractMs = Date.now() - extractStarted;
    const proposals = mapExtractionToProposals(extraction);

    const sesionId = newId("dic");
    const latenciaMs = Date.now() - started;

    await withTenant(
      { clinicaId: gate.ctx.clinicaId, userId: gate.ctx.userId },
      async (tx) => {
        await tx.insert(sesionesDictado).values({
          id: sesionId,
          clinicaId: gate.ctx.clinicaId,
          visitaId: gate.visita.id,
          transcripcion: transcript,
          prompt: `rule/extractor=${extractor.name}; denticion=${gate.denticion}`,
          respuestaRaw: JSON.stringify(extraction),
          modeloStt,
          modeloLlm: extractor.name,
          latenciaMs,
          camposAceptadosCorregidos: null,
          // Never retain audio in F4 unless clinic flag is on — and we still don't store blob
          audioRetenido: false,
        });
        await writeAudit(tx, {
          clinicaId: gate.ctx.clinicaId,
          actorUserId: gate.ctx.userId,
          accion: "dictado_process",
          entidad: "sesiones_dictado",
          entidadId: sesionId,
          valorNuevo: {
            hallazgos: extraction.hallazgos.length,
            sttMs,
            extractMs,
          },
        });
      },
    );

    return {
      ok: true,
      data: {
        sesionId,
        transcripcion: transcript,
        extraction,
        proposals,
        modeloStt,
        modeloLlm: extractor.name,
        latenciaMs,
        sttConfigured: sttConfigured(),
        odontogramaId: gate.odontograma.id,
        visitaId: gate.visita.id,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error en dictado",
    };
  }
}

export async function acceptDictadoProposalsAction(
  clinicaId: string,
  pacienteId: string,
  input: {
    sesionId: string;
    odontogramaId: string;
    accepted: Array<{ id: string; transition: Transition }>;
  },
): Promise<ActionResult<{ applied: number; errors: string[] }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "dictado_use");

  const errors: string[] = [];
  let applied = 0;

  for (const item of input.accepted) {
    const result = await applyOdontogramaTransitionAction(
      clinicaId,
      input.odontogramaId,
      item.transition,
    );
    if (result.ok === false) {
      errors.push(`${item.id}: ${result.error}`);
    } else {
      applied += 1;
    }
  }

  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        await tx
          .update(sesionesDictado)
          .set({
            camposAceptadosCorregidos: {
              accepted: input.accepted,
              applied,
              errors,
              pacienteId,
            },
          })
          .where(eq(sesionesDictado.id, input.sesionId));
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "dictado_accept",
          entidad: "sesiones_dictado",
          entidadId: input.sesionId,
          valorNuevo: { applied, errors },
        });
      },
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar aceptación",
    };
  }

  return { ok: true, data: { applied, errors } };
}

export async function getDictadoStatusAction(
  clinicaId: string,
  pacienteId: string,
): Promise<
  ActionResult<{
    canDictar: boolean;
    sttConfigured: boolean;
    reason?: string;
  }>
> {
  try {
    await assertDictadoAllowed(clinicaId, pacienteId);
    return {
      ok: true,
      data: { canDictar: true, sttConfigured: sttConfigured() },
    };
  } catch (err) {
    return {
      ok: true,
      data: {
        canDictar: false,
        sttConfigured: sttConfigured(),
        reason: err instanceof Error ? err.message : "No permitido",
      },
    };
  }
}
