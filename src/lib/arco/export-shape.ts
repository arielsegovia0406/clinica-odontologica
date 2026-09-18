/** Serialize dates/json-safe values for ARCO export packages. */
export function toExportValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toExportValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = toExportValue(v);
    }
    return out;
  }
  return value;
}

export type ArcoExportPackage = {
  schemaVersion: 1;
  generadoEn: string;
  clinicaId: string;
  solicitudId: string;
  paciente: unknown;
  consentimientos: unknown[];
  anamnesis: unknown[];
  visitas: unknown[];
  odontogramas: unknown[];
  indices: unknown[];
  diagnosticos: unknown[];
  documentosGenerados: unknown[];
  sesionesDictado: unknown[];
  solicitudesArco: unknown[];
};
