"use server";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  hasCapability,
  requireCapability,
  requireClinicContext,
} from "@/lib/auth/clinic-context";
import { nextAnamnesisVersion } from "@/lib/clinical/anamnesis-version";
import {
  canStartClinicalCare,
  hasGrabacionAudioVigente,
  hasTratamientoDatosVigente,
} from "@/lib/clinical/consent-rules";
import { getConsentText, getLatestConsentText } from "@/lib/consent/texts";
import { writeAudit } from "@/lib/db/audit";
import {
  anamnesis,
  consentimientos,
  pacientes,
  visitas,
} from "@/lib/db/schema";
import { withTenant } from "@/lib/db/with-tenant";
import { newId } from "@/lib/ids";
import { anamnesisCreateSchema } from "@/lib/validation/anamnesis";
import { consentimientoCreateSchema } from "@/lib/validation/consentimiento";
import {
  pacienteCreateSchema,
  pacienteUpdateSchema,
} from "@/lib/validation/paciente";
import {
  signosVitalesSchema,
  visitaSignosSchema,
} from "@/lib/validation/signos-vitales";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function emptyToNull(value: string | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  return value.trim();
}

async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

function revalidatePaciente(clinicaId: string, pacienteId?: string) {
  revalidatePath(`/app/${clinicaId}/pacientes`);
  if (pacienteId) {
    revalidatePath(`/app/${clinicaId}/pacientes/${pacienteId}`);
  }
}

export async function searchPacientesAction(
  clinicaId: string,
  q: string,
): Promise<
  ActionResult<
    Array<{
      id: string;
      nombres: string;
      apellidos: string;
      numeroDocumento: string;
      tipoDocumento: "cedula" | "pasaporte";
      numeroArchivo: string | null;
    }>
  >
> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "paciente_read");
  const query = q.trim();

  const rows = await withTenant(
    { clinicaId: ctx.clinicaId, userId: ctx.userId },
    async (tx) => {
      const base = tx
        .select({
          id: pacientes.id,
          nombres: pacientes.nombres,
          apellidos: pacientes.apellidos,
          numeroDocumento: pacientes.numeroDocumento,
          tipoDocumento: pacientes.tipoDocumento,
          numeroArchivo: pacientes.numeroArchivo,
        })
        .from(pacientes)
        .orderBy(pacientes.apellidos, pacientes.nombres)
        .limit(50);

      if (!query) {
        return base;
      }

      const pattern = `%${query}%`;
      return tx
        .select({
          id: pacientes.id,
          nombres: pacientes.nombres,
          apellidos: pacientes.apellidos,
          numeroDocumento: pacientes.numeroDocumento,
          tipoDocumento: pacientes.tipoDocumento,
          numeroArchivo: pacientes.numeroArchivo,
        })
        .from(pacientes)
        .where(
          or(
            ilike(pacientes.nombres, pattern),
            ilike(pacientes.apellidos, pattern),
            ilike(pacientes.numeroDocumento, pattern),
            ilike(pacientes.numeroArchivo, pattern),
          ),
        )
        .orderBy(pacientes.apellidos, pacientes.nombres)
        .limit(50);
    },
  );

  return { ok: true, data: rows };
}

export async function createPacienteAction(
  clinicaId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "paciente_write");
  const parsed = pacienteCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;
  const meta = await requestMeta();
  const id = newId("pac");

  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        await tx.insert(pacientes).values({
          id,
          clinicaId: ctx.clinicaId,
          tipoDocumento: input.tipoDocumento,
          numeroDocumento: input.numeroDocumento.trim(),
          nombres: input.nombres.trim(),
          apellidos: input.apellidos.trim(),
          fechaNacimiento: new Date(input.fechaNacimiento),
          sexo: input.sexo,
          direccion: emptyToNull(input.direccion),
          telefono: emptyToNull(input.telefono),
          email: emptyToNull(input.email),
          contactoEmergenciaNombre: emptyToNull(input.contactoEmergenciaNombre),
          contactoEmergenciaTelefono: emptyToNull(
            input.contactoEmergenciaTelefono,
          ),
          numeroArchivo: emptyToNull(input.numeroArchivo),
          createdBy: ctx.userId,
        });
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "create",
          entidad: "pacientes",
          entidadId: id,
          valorNuevo: {
            tipoDocumento: input.tipoDocumento,
            numeroDocumento: input.numeroDocumento,
            nombres: input.nombres,
            apellidos: input.apellidos,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear";
    if (message.includes("unique") || message.includes("pacientes_doc_uidx")) {
      return { ok: false, error: "Ya existe un paciente con ese documento" };
    }
    return { ok: false, error: message };
  }

  revalidatePaciente(clinicaId, id);
  return { ok: true, data: { id } };
}

export async function updatePacienteAction(
  clinicaId: string,
  pacienteId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "paciente_write");
  const parsed = pacienteUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;
  const meta = await requestMeta();

  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const existing = await tx
          .select()
          .from(pacientes)
          .where(eq(pacientes.id, pacienteId))
          .limit(1);
        const prev = existing[0];
        if (!prev) throw new Error("Paciente no encontrado");

        await tx
          .update(pacientes)
          .set({
            tipoDocumento: input.tipoDocumento,
            numeroDocumento: input.numeroDocumento.trim(),
            nombres: input.nombres.trim(),
            apellidos: input.apellidos.trim(),
            fechaNacimiento: new Date(input.fechaNacimiento),
            sexo: input.sexo,
            direccion: emptyToNull(input.direccion),
            telefono: emptyToNull(input.telefono),
            email: emptyToNull(input.email),
            contactoEmergenciaNombre: emptyToNull(input.contactoEmergenciaNombre),
            contactoEmergenciaTelefono: emptyToNull(
              input.contactoEmergenciaTelefono,
            ),
            numeroArchivo: emptyToNull(input.numeroArchivo),
            updatedAt: new Date(),
          })
          .where(eq(pacientes.id, pacienteId));

        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "update",
          entidad: "pacientes",
          entidadId: pacienteId,
          valorAnterior: {
            nombres: prev.nombres,
            apellidos: prev.apellidos,
            numeroDocumento: prev.numeroDocumento,
          },
          valorNuevo: {
            nombres: input.nombres,
            apellidos: input.apellidos,
            numeroDocumento: input.numeroDocumento,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar";
    if (message.includes("unique") || message.includes("pacientes_doc_uidx")) {
      return { ok: false, error: "Ya existe un paciente con ese documento" };
    }
    return { ok: false, error: message };
  }

  revalidatePaciente(clinicaId, pacienteId);
  return { ok: true, data: { id: pacienteId } };
}

export async function createConsentimientoAction(
  clinicaId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "consentimiento_write");
  const parsed = consentimientoCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;
  let catalog;
  try {
    catalog = getConsentText(input.tipo, input.versionTexto);
  } catch {
    return { ok: false, error: "Versión de texto de consentimiento desconocida" };
  }
  const meta = await requestMeta();
  const id = newId("con");

  try {
    await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const pac = await tx
          .select({ id: pacientes.id })
          .from(pacientes)
          .where(eq(pacientes.id, input.pacienteId))
          .limit(1);
        if (!pac[0]) throw new Error("Paciente no encontrado");

        await tx.insert(consentimientos).values({
          id,
          clinicaId: ctx.clinicaId,
          pacienteId: input.pacienteId,
          tipo: input.tipo,
          versionTexto: catalog.version,
          textoHash: catalog.hash,
          metodo: input.metodo,
          capturadoPor: ctx.userId,
          ip: meta.ip,
        });
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "create",
          entidad: "consentimientos",
          entidadId: id,
          valorNuevo: {
            tipo: input.tipo,
            versionTexto: catalog.version,
            metodo: input.metodo,
            pacienteId: input.pacienteId,
          },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
      },
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al registrar consentimiento",
    };
  }

  revalidatePaciente(clinicaId, input.pacienteId);
  return { ok: true, data: { id } };
}

export async function createAnamnesisVersionAction(
  clinicaId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; version: number }>> {
  const ctx = await requireClinicContext(clinicaId);
  if (!hasCapability(ctx, "anamnesis_write")) {
    return {
      ok: false,
      error: `Forbidden: role ${ctx.role} cannot anamnesis_write`,
    };
  }
  const parsed = anamnesisCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;
  const meta = await requestMeta();

  try {
    const result = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const pac = await tx
          .select({ id: pacientes.id })
          .from(pacientes)
          .where(eq(pacientes.id, input.pacienteId))
          .limit(1);
        if (!pac[0]) throw new Error("Paciente no encontrado");

        const consents = await tx
          .select({
            tipo: consentimientos.tipo,
            revocadoEn: consentimientos.revocadoEn,
            aceptadoEn: consentimientos.aceptadoEn,
          })
          .from(consentimientos)
          .where(eq(consentimientos.pacienteId, input.pacienteId));

        if (!canStartClinicalCare(consents)) {
          throw new Error(
            "Se requiere consentimiento vigente de tratamiento de datos",
          );
        }

        const versions = await tx
          .select({ version: anamnesis.version })
          .from(anamnesis)
          .where(eq(anamnesis.pacienteId, input.pacienteId));
        const version = nextAnamnesisVersion(versions.map((v) => v.version));
        const id = newId("ana");

        const snapshot = {
          antecedentesPersonales: emptyToNull(input.antecedentesPersonales),
          antecedentesFamiliares: emptyToNull(input.antecedentesFamiliares),
          alergias: emptyToNull(input.alergias),
          medicacionActual: emptyToNull(input.medicacionActual),
          embarazoLactancia: emptyToNull(input.embarazoLactancia),
          habitos: emptyToNull(input.habitos),
        };

        await tx.insert(anamnesis).values({
          id,
          clinicaId: ctx.clinicaId,
          pacienteId: input.pacienteId,
          version,
          ...snapshot,
          registradoPor: ctx.userId,
        });
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "create_version",
          entidad: "anamnesis",
          entidadId: id,
          valorNuevo: { version, pacienteId: input.pacienteId, ...snapshot },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        return { id, version };
      },
    );
    revalidatePaciente(clinicaId, input.pacienteId);
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar anamnesis",
    };
  }
}

export async function ensureVisitaBorradorAction(
  clinicaId: string,
  pacienteId: string,
): Promise<ActionResult<{ visitaId: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "visita_borrador");
  const meta = await requestMeta();

  try {
    const visitaId = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const pac = await tx
          .select({ id: pacientes.id })
          .from(pacientes)
          .where(eq(pacientes.id, pacienteId))
          .limit(1);
        if (!pac[0]) throw new Error("Paciente no encontrado");

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

        const existing = await tx
          .select({ id: visitas.id })
          .from(visitas)
          .where(
            and(eq(visitas.pacienteId, pacienteId), eq(visitas.estado, "borrador")),
          )
          .orderBy(desc(visitas.createdAt))
          .limit(1);
        if (existing[0]) return existing[0].id;

        const id = newId("vis");
        await tx.insert(visitas).values({
          id,
          clinicaId: ctx.clinicaId,
          pacienteId,
          profesionalMembresiaId: ctx.memberId,
          estado: "borrador",
        });
        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "create",
          entidad: "visitas",
          entidadId: id,
          valorNuevo: { pacienteId, estado: "borrador" },
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        return id;
      },
    );
    revalidatePaciente(clinicaId, pacienteId);
    return { ok: true, data: { visitaId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al iniciar atención",
    };
  }
}

export async function updateSignosVitalesAction(
  clinicaId: string,
  raw: unknown,
): Promise<ActionResult<{ visitaId: string }>> {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "signos_vitales_write");
  const parsed = visitaSignosSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;
  const signos = signosVitalesSchema.parse(input.signosVitales);
  const meta = await requestMeta();

  try {
    const visitaId = await withTenant(
      { clinicaId: ctx.clinicaId, userId: ctx.userId },
      async (tx) => {
        const consents = await tx
          .select({
            tipo: consentimientos.tipo,
            revocadoEn: consentimientos.revocadoEn,
            aceptadoEn: consentimientos.aceptadoEn,
          })
          .from(consentimientos)
          .where(eq(consentimientos.pacienteId, input.pacienteId));
        if (!canStartClinicalCare(consents)) {
          throw new Error(
            "Se requiere consentimiento vigente de tratamiento de datos",
          );
        }

        let draft = await tx
          .select({ id: visitas.id, signosVitales: visitas.signosVitales })
          .from(visitas)
          .where(
            and(
              eq(visitas.pacienteId, input.pacienteId),
              eq(visitas.estado, "borrador"),
            ),
          )
          .orderBy(desc(visitas.createdAt))
          .limit(1);

        if (!draft[0]) {
          const id = newId("vis");
          await tx.insert(visitas).values({
            id,
            clinicaId: ctx.clinicaId,
            pacienteId: input.pacienteId,
            profesionalMembresiaId: ctx.memberId,
            estado: "borrador",
            signosVitales: signos,
          });
          draft = [{ id, signosVitales: null }];
        } else {
          await tx
            .update(visitas)
            .set({ signosVitales: signos, updatedAt: new Date() })
            .where(eq(visitas.id, draft[0].id));
        }

        await writeAudit(tx, {
          clinicaId: ctx.clinicaId,
          actorUserId: ctx.userId,
          accion: "update_signos_vitales",
          entidad: "visitas",
          entidadId: draft[0]!.id,
          valorAnterior: draft[0]!.signosVitales ?? null,
          valorNuevo: signos,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        return draft[0]!.id;
      },
    );
    revalidatePaciente(clinicaId, input.pacienteId);
    return { ok: true, data: { visitaId } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar signos vitales",
    };
  }
}

/** Server-side loader for patient ficha (not a mutation). */
export async function loadPacienteFicha(clinicaId: string, pacienteId: string) {
  const ctx = await requireClinicContext(clinicaId);
  requireCapability(ctx, "paciente_read");
  const canReadAnamnesis = hasCapability(ctx, "anamnesis_read");

  return withTenant(
    { clinicaId: ctx.clinicaId, userId: ctx.userId },
    async (tx) => {
      const pacRows = await tx
        .select()
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);
      const paciente = pacRows[0];
      if (!paciente) return null;

      const consents = await tx
        .select({
          id: consentimientos.id,
          tipo: consentimientos.tipo,
          versionTexto: consentimientos.versionTexto,
          textoHash: consentimientos.textoHash,
          aceptadoEn: consentimientos.aceptadoEn,
          metodo: consentimientos.metodo,
          revocadoEn: consentimientos.revocadoEn,
        })
        .from(consentimientos)
        .where(eq(consentimientos.pacienteId, pacienteId))
        .orderBy(desc(consentimientos.aceptadoEn));

      const anamnesisCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(anamnesis)
        .where(eq(anamnesis.pacienteId, pacienteId));

      const anamnesisVersions = canReadAnamnesis
        ? await tx
            .select({
              id: anamnesis.id,
              version: anamnesis.version,
              antecedentesPersonales: anamnesis.antecedentesPersonales,
              antecedentesFamiliares: anamnesis.antecedentesFamiliares,
              alergias: anamnesis.alergias,
              medicacionActual: anamnesis.medicacionActual,
              embarazoLactancia: anamnesis.embarazoLactancia,
              habitos: anamnesis.habitos,
              registradoEn: anamnesis.registradoEn,
              registradoPor: anamnesis.registradoPor,
            })
            .from(anamnesis)
            .where(eq(anamnesis.pacienteId, pacienteId))
            .orderBy(desc(anamnesis.version))
        : [];

      const draft = await tx
        .select({
          id: visitas.id,
          signosVitales: visitas.signosVitales,
          createdAt: visitas.createdAt,
        })
        .from(visitas)
        .where(
          and(eq(visitas.pacienteId, pacienteId), eq(visitas.estado, "borrador")),
        )
        .orderBy(desc(visitas.createdAt))
        .limit(1);

      return {
        paciente,
        consents,
        anamnesisVersions,
        anamnesisExists: (anamnesisCount[0]?.count ?? 0) > 0,
        anamnesisCount: anamnesisCount[0]?.count ?? 0,
        canReadAnamnesis,
        canWriteAnamnesis: hasCapability(ctx, "anamnesis_write"),
        hasTratamientoDatos: hasTratamientoDatosVigente(consents),
        hasGrabacionAudio: hasGrabacionAudioVigente(consents),
        visitaBorrador: draft[0] ?? null,
        consentCatalog: {
          tratamiento_datos: getLatestConsentText("tratamiento_datos"),
          grabacion_audio: getLatestConsentText("grabacion_audio"),
        },
        role: ctx.role,
      };
    },
  );
}
