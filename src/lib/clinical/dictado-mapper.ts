import type { Transition } from "@/lib/clinical/odontograma";
import type { ClinicalExtraction } from "@/lib/ai/clinical-extractor";

const ESTADOS_CARA = new Set([
  "caries",
  "obturado",
  "sellante_necesario",
  "sellante_realizado",
]);

const ESTADOS_PIEZA = new Set([
  "sano",
  "extraccion_indicada",
  "perdida_caries",
  "perdida_otra_causa",
  "ausente",
  "endodoncia_indicada",
  "endodoncia_realizada",
  "corona_indicada",
  "corona_realizada",
]);

export type MappedProposal = {
  id: string;
  source: "hallazgo" | "comando";
  label: string;
  transition: Transition | null;
  rejectedReason?: string;
  confianza: number;
  piezaFdi?: number;
};

function normalizeEstado(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_")
    .replace(/obturada/, "obturado")
    .replace(/obturadoa/, "obturado");
}

/**
 * Maps extractor output to odontograma transitions.
 * Never invents teeth; unknown estados are rejected.
 */
export function mapExtractionToProposals(
  extraction: ClinicalExtraction,
): MappedProposal[] {
  const out: MappedProposal[] = [];
  let i = 0;

  for (const h of extraction.hallazgos) {
    const estado = normalizeEstado(h.estado);
    const id = `h-${i++}-${h.piezaFdi}`;
    if (h.cara && ESTADOS_CARA.has(estado)) {
      out.push({
        id,
        source: "hallazgo",
        label: `Pieza ${h.piezaFdi} · ${h.cara} · ${estado}`,
        confianza: h.confianza,
        piezaFdi: h.piezaFdi,
        transition: {
          type: "set_cara",
          piezaFdi: h.piezaFdi,
          cara: h.cara,
          estado: estado as
            | "caries"
            | "obturado"
            | "sellante_necesario"
            | "sellante_realizado",
        },
      });
      continue;
    }
    if (!h.cara && ESTADOS_PIEZA.has(estado)) {
      out.push({
        id,
        source: "hallazgo",
        label: `Pieza ${h.piezaFdi} · ${estado}`,
        confianza: h.confianza,
        piezaFdi: h.piezaFdi,
        transition: {
          type: "set_estado_pieza",
          piezaFdi: h.piezaFdi,
          estadoPieza: estado as
            | "sano"
            | "extraccion_indicada"
            | "perdida_caries"
            | "perdida_otra_causa"
            | "ausente"
            | "endodoncia_indicada"
            | "endodoncia_realizada"
            | "corona_indicada"
            | "corona_realizada",
        },
      });
      continue;
    }
    out.push({
      id,
      source: "hallazgo",
      label: `Pieza ${h.piezaFdi} · ${h.estado} (no mapeable)`,
      confianza: h.confianza,
      piezaFdi: h.piezaFdi,
      transition: null,
      rejectedReason: h.cara
        ? `Estado de cara desconocido: ${h.estado}`
        : `Estado de pieza desconocido o falta cara: ${h.estado}`,
    });
  }

  for (const c of extraction.comandos) {
    const id = `c-${i++}-${c.tipo}`;
    if (c.tipo === "borrar_pieza" && c.piezaFdi != null) {
      out.push({
        id,
        source: "comando",
        label: `Borrar pieza ${c.piezaFdi}`,
        confianza: 1,
        piezaFdi: c.piezaFdi,
        transition: { type: "clear_pieza", piezaFdi: c.piezaFdi },
      });
    } else {
      out.push({
        id,
        source: "comando",
        label: `Comando ${c.tipo}`,
        confianza: 1,
        piezaFdi: c.piezaFdi,
        transition: null,
        rejectedReason: "Comando no aplicable automáticamente en F4",
      });
    }
  }

  return out;
}
