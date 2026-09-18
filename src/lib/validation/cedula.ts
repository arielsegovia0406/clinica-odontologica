/**
 * Validación de cédula ecuatoriana.
 *
 * Formato Fase 1: exactamente 10 dígitos + dígito verificador (módulo 10).
 *
 * PENDIENTE: confirmar con abogado/registro civil el tratamiento de códigos
 * de provincia especiales y cédulas de personas jurídicas / extranjeros
 * antes de endurecer reglas en producción.
 */
export function isValidCedulaFormato(value: string): boolean {
  return /^\d{10}$/.test(value);
}

/**
 * Algoritmo estándar de dígito verificador para cédula de persona natural.
 * Retorna false si el formato es inválido o el checksum no coincide.
 */
export function isValidCedulaChecksum(value: string): boolean {
  if (!isValidCedulaFormato(value)) return false;

  const digits = value.split("").map((d) => Number(d));
  const province = digits[0]! * 10 + digits[1]!;
  if (province < 1 || (province > 24 && province !== 30)) return false;

  const third = digits[2]!;
  if (third >= 6) return false;

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let product = digits[i]! * coefficients[i]!;
    if (product >= 10) product -= 9;
    sum += product;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[9];
}

export function validateCedula(value: string): {
  ok: boolean;
  reason?: "formato" | "checksum";
} {
  if (!isValidCedulaFormato(value)) return { ok: false, reason: "formato" };
  if (!isValidCedulaChecksum(value)) return { ok: false, reason: "checksum" };
  return { ok: true };
}
