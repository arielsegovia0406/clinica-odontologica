/**
 * Escala de movilidad / recesión — configurable.
 * MSP formulario odontología: candidato 2008 usa 1–3; circula revisión 2021 con 1–4.
 * Confirmar cuál rige antes de producción; cambiar escala = editar aquí + migrar enum PG si hace falta.
 */
export const GRADO_ESCALA = {
  id: "msp-2008-candidato",
  valores: ["1", "2", "3"] as const,
  max: 3,
  pendienteConfirmacion: true as const,
  nota: "Pendiente confirmar si rige escala 1–3 (2008) o 1–4 (revisión 2021).",
} as const;

export type GradoValor = (typeof GRADO_ESCALA.valores)[number];

export function isGradoValor(value: string): value is GradoValor {
  return (GRADO_ESCALA.valores as readonly string[]).includes(value);
}

/** Heurística de dentición por edad cumplida (override manual siempre permitido). */
export function sugerirDenticionPorEdad(
  ageYears: number,
): "permanente" | "temporal" | "mixta" {
  if (ageYears < 6) return "temporal";
  if (ageYears <= 12) return "mixta";
  return "permanente";
}
