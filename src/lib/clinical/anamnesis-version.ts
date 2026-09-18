/** Pure rule: next anamnesis version is max existing + 1 (never overwrite). */
export function nextAnamnesisVersion(existingVersions: number[]): number {
  if (existingVersions.length === 0) return 1;
  return Math.max(...existingVersions) + 1;
}

export type AnamnesisFields = {
  antecedentesPersonales?: string | null;
  antecedentesFamiliares?: string | null;
  alergias?: string | null;
  medicacionActual?: string | null;
  embarazoLactancia?: string | null;
  habitos?: string | null;
};

/** Snapshot for audit / equality checks — always insert a new row on save. */
export function anamnesisSnapshot(fields: AnamnesisFields): AnamnesisFields {
  return {
    antecedentesPersonales: fields.antecedentesPersonales ?? null,
    antecedentesFamiliares: fields.antecedentesFamiliares ?? null,
    alergias: fields.alergias ?? null,
    medicacionActual: fields.medicacionActual ?? null,
    embarazoLactancia: fields.embarazoLactancia ?? null,
    habitos: fields.habitos ?? null,
  };
}
