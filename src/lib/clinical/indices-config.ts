/**
 * Constantes clínicas de índices — cambiar aquí, no en la UI.
 * Fuentes: docs/INDICES.md (WHO/Klein-Palmer, Gruebbel ceo-d, Greene & Vermillion 1964).
 */

/** Si true, FDI 18/28/38/48 no entran en CPO-D (práctica epidemiológica de 28 dientes). */
export const CPO_EXCLUIR_TERCEROS = false;

/** Dientes índice IHOS (Greene & Vermillion) y cara a examinar. */
export const IHOS_DIENTES_INDICE = [
  { principal: 16, cara: "vestibular", sustitutos: [17, 15] },
  { principal: 11, cara: "vestibular", sustitutos: [21, 12] },
  { principal: 26, cara: "vestibular", sustitutos: [27, 25] },
  { principal: 36, cara: "lingual", sustitutos: [37, 35] },
  { principal: 31, cara: "vestibular", sustitutos: [41, 32] },
  { principal: 46, cara: "lingual", sustitutos: [47, 45] },
] as const;

export type IhosScorePlaca = 0 | 1 | 2 | 3;
export type IhosScoreCalculo = 0 | 1 | 2 | 3;
export type IhosScoreGingivitis = 0 | 1;
