export type ConsentRecordLike = {
  tipo: "tratamiento_datos" | "grabacion_audio";
  revocadoEn: Date | string | null;
  aceptadoEn: Date | string;
};

export function isConsentVigente(
  row: ConsentRecordLike | null | undefined,
): boolean {
  if (!row) return false;
  return row.revocadoEn == null;
}

/**
 * Among rows of the same tipo, the vigente one is the latest non-revoked
 * by aceptadoEn. If all revoked, none is vigente.
 */
export function findVigenteConsent(
  rows: ConsentRecordLike[],
  tipo: ConsentRecordLike["tipo"],
): ConsentRecordLike | null {
  const ofType = rows
    .filter((r) => r.tipo === tipo && r.revocadoEn == null)
    .sort((a, b) => {
      const ta = new Date(a.aceptadoEn).getTime();
      const tb = new Date(b.aceptadoEn).getTime();
      return tb - ta;
    });
  return ofType[0] ?? null;
}

export function hasTratamientoDatosVigente(rows: ConsentRecordLike[]): boolean {
  return findVigenteConsent(rows, "tratamiento_datos") != null;
}

export function hasGrabacionAudioVigente(rows: ConsentRecordLike[]): boolean {
  return findVigenteConsent(rows, "grabacion_audio") != null;
}

/** Blocks anamnesis / iniciar atención until tratamiento_datos is vigente. */
export function canStartClinicalCare(rows: ConsentRecordLike[]): boolean {
  return hasTratamientoDatosVigente(rows);
}

/** Dictation CTA (Fase 4) stays disabled without grabacion_audio. */
export function canEnableDictado(rows: ConsentRecordLike[]): boolean {
  return hasGrabacionAudioVigente(rows);
}
