import { createHash } from "node:crypto";
import type { tipoConsentimientoSchema } from "@/lib/validation/consentimiento";
import type { z } from "zod";

export type TipoConsentimiento = z.infer<typeof tipoConsentimientoSchema>;

export type ConsentTextEntry = {
  tipo: TipoConsentimiento;
  version: string;
  texto: string;
  hash: string;
};

function hashTexto(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/**
 * Textos PROVISIONALES — pendientes de revisión legal (LOPDP Ecuador).
 * No usar como texto definitivo en producción sin abogado.
 */
const RAW: Omit<ConsentTextEntry, "hash">[] = [
  {
    tipo: "tratamiento_datos",
    version: "td-2026-09-v1",
    texto: [
      "CONSENTIMIENTO INFORMADO — TRATAMIENTO DE DATOS PERSONALES Y DE SALUD (texto provisional)",
      "",
      "Autorizo a la clínica odontológica a recolectar, almacenar y tratar mis datos",
      "personales y de salud con la finalidad de prestar atención odontológica,",
      "elaborar la historia clínica y cumplir obligaciones legales aplicables en Ecuador.",
      "Puedo ejercer derechos ARCO según la LOPDP, sin perjuicio de plazos de retención",
      "de la historia clínica. Este texto es provisional y será sustituido tras revisión legal.",
    ].join("\n"),
  },
  {
    tipo: "grabacion_audio",
    version: "ga-2026-09-v1",
    texto: [
      "CONSENTIMIENTO INFORMADO — GRABACIÓN DE AUDIO PARA DICTADO CLÍNICO (texto provisional)",
      "",
      "Autorizo la grabación temporal de audio durante la consulta con el único fin de",
      "asistir al profesional en la documentación clínica mediante dictado. El audio no",
      "se retiene por defecto. Puedo revocar este consentimiento. Texto provisional",
      "pendiente de revisión legal.",
    ].join("\n"),
  },
];

export const CONSENT_TEXTS: ConsentTextEntry[] = RAW.map((entry) => ({
  ...entry,
  hash: hashTexto(entry.texto),
}));

export function getConsentText(
  tipo: TipoConsentimiento,
  version?: string,
): ConsentTextEntry {
  const matches = CONSENT_TEXTS.filter((t) => t.tipo === tipo);
  const found = version
    ? matches.find((t) => t.version === version)
    : matches[matches.length - 1];
  if (!found) {
    throw new Error(`Consent text not found: ${tipo} ${version ?? "latest"}`);
  }
  return found;
}

export function getLatestConsentText(tipo: TipoConsentimiento): ConsentTextEntry {
  return getConsentText(tipo);
}
