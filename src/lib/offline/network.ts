/** Heuristic: failed server action / fetch while unreachable. */
export function isLikelyNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|econnrefused|offline/i.test(
    msg,
  );
}

export function draftKey(clinicaId: string, odontogramaId: string): string {
  return `${clinicaId}:${odontogramaId}`;
}
