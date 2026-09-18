export type ClinicRole = "odontologo" | "auxiliar" | "admin";

export type ClinicalCapability =
  | "paciente_read"
  | "paciente_write"
  | "consentimiento_write"
  | "anamnesis_read"
  | "anamnesis_write"
  | "visita_borrador"
  | "signos_vitales_write"
  | "odontograma_read"
  | "odontograma_write"
  | "indices_read"
  | "indices_write"
  | "dictado_use"
  | "documento_read"
  | "documento_firmar"
  | "arco_solicitar"
  | "arco_admin";

const allClinical = [
  "paciente_read",
  "paciente_write",
  "consentimiento_write",
  "anamnesis_read",
  "anamnesis_write",
  "visita_borrador",
  "signos_vitales_write",
  "odontograma_read",
  "odontograma_write",
  "indices_read",
  "indices_write",
  "dictado_use",
  "documento_read",
  "documento_firmar",
  "arco_solicitar",
  "arco_admin",
] as const;

const ROLE_CAPABILITIES: Record<ClinicRole, ReadonlySet<ClinicalCapability>> = {
  odontologo: new Set(
    allClinical.filter((c) => c !== "arco_admin") as ClinicalCapability[],
  ),
  admin: new Set(allClinical),
  /** Auxiliar: sin anamnesis; puede leer docs pero no firmar el 033. */
  auxiliar: new Set([
    "paciente_read",
    "paciente_write",
    "consentimiento_write",
    "visita_borrador",
    "signos_vitales_write",
    "odontograma_read",
    "odontograma_write",
    "indices_read",
    "indices_write",
    "dictado_use",
    "documento_read",
    "arco_solicitar",
  ]),
};

export function isClinicRole(value: string): value is ClinicRole {
  return value === "odontologo" || value === "auxiliar" || value === "admin";
}

export function can(role: string, capability: ClinicalCapability): boolean {
  if (!isClinicRole(role)) return false;
  return ROLE_CAPABILITIES[role].has(capability);
}

export function assertCan(role: string, capability: ClinicalCapability): void {
  if (!can(role, capability)) {
    throw new Error(`Forbidden: role ${role} cannot ${capability}`);
  }
}
