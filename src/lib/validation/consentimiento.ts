import { z } from "zod";

export const tipoConsentimientoSchema = z.enum([
  "tratamiento_datos",
  "grabacion_audio",
]);

export const metodoConsentimientoSchema = z.enum([
  "firma_pantalla",
  "checkbox_explicito",
  "papel_digitalizado",
]);

export const consentimientoCreateSchema = z.object({
  pacienteId: z.string().min(1),
  tipo: tipoConsentimientoSchema,
  metodo: metodoConsentimientoSchema,
  /** Must match a catalog entry; server re-resolves hash from version. */
  versionTexto: z.string().min(1),
});

export type ConsentimientoCreateInput = z.infer<
  typeof consentimientoCreateSchema
>;
