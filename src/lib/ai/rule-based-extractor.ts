import {
  clinicalExtractionSchema,
  type ClinicalExtraction,
  type ClinicalExtractor,
  type ExtractorInput,
} from "./clinical-extractor";

const CARAS =
  "vestibular|lingual|palatino|mesial|distal|oclusal|incisal";

/**
 * Deterministic Spanish clinical phrase parser.
 * Only emits hallazgos explicitly mentioned — never invents "sano".
 */
export class RuleBasedClinicalExtractor implements ClinicalExtractor {
  readonly name = "rule-based-es";

  async extract(input: ExtractorInput): Promise<ClinicalExtraction> {
    const text = input.transcription.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const hallazgos: ClinicalExtraction["hallazgos"] = [];
    const comandos: ClinicalExtraction["comandos"] = [];
    const seen = new Set<string>();

    const push = (
      piezaFdi: number,
      estado: string,
      cara?: ClinicalExtraction["hallazgos"][number]["cara"],
      confianza = 0.85,
    ) => {
      const key = `${piezaFdi}:${cara ?? ""}:${estado}`;
      if (seen.has(key)) return;
      seen.add(key);
      hallazgos.push({ piezaFdi, cara, estado, confianza });
    };

    // "borrar pieza 16" / "borrar 16"
    for (const m of text.matchAll(/borrar(?:\s+pieza)?\s+(\d{2})\b/gi)) {
      comandos.push({ tipo: "borrar_pieza", piezaFdi: Number(m[1]) });
    }

    // "caries en 16 oclusal" / "caries 16"
    for (const m of text.matchAll(
      new RegExp(
        `\\b(caries|obturad[oa]|sellante\\s+necesario|sellante\\s+realizado)\\s+(?:en\\s+)?(?:pieza\\s+)?(\\d{2})(?:\\s+(${CARAS}))?`,
        "gi",
      ),
    )) {
      const estado = normalizeEstadoWord(m[1]!);
      const cara = m[3] as ClinicalExtraction["hallazgos"][number]["cara"] | undefined;
      push(Number(m[2]), estado, cara);
    }

    // "16 oclusal con caries" / "26 obturado"
    for (const m of text.matchAll(
      new RegExp(
        `\\b(\\d{2})(?:\\s+(${CARAS}))?\\s+(?:con\\s+)?(caries|obturad[oa]|sellante\\s+necesario|sellante\\s+realizado)\\b`,
        "gi",
      ),
    )) {
      const cara = m[2] as ClinicalExtraction["hallazgos"][number]["cara"] | undefined;
      push(Number(m[1]), normalizeEstadoWord(m[3]!), cara);
    }

    // Piece-level: "ausente 36", "36 ausente", "extraccion indicada 14"
    for (const m of text.matchAll(
      /\b(ausente|extraccion\s+indicada|perdida\s+por\s+caries|perdida\s+otra\s+causa|endodoncia\s+indicada|endodoncia\s+realizada|corona\s+indicada|corona\s+realizada|sano)\s+(?:pieza\s+)?(\d{2})\b/gi,
    )) {
      push(Number(m[2]), normalizeEstadoWord(m[1]!));
    }
    for (const m of text.matchAll(
      /\b(\d{2})\s+(ausente|extraccion\s+indicada|perdida\s+por\s+caries|perdida\s+otra\s+causa|endodoncia\s+indicada|endodoncia\s+realizada|corona\s+indicada|corona\s+realizada|sano)\b/gi,
    )) {
      push(Number(m[1]), normalizeEstadoWord(m[2]!));
    }

    // Filter by denticion FDI ranges lightly: keep all mentioned; UI/server validate
    const raw = {
      hallazgos,
      diagnosticosSugeridos: [] as ClinicalExtraction["diagnosticosSugeridos"],
      comandos,
    };
    return clinicalExtractionSchema.parse(raw);
  }
}

function normalizeEstadoWord(raw: string): string {
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, "_");
  if (s.startsWith("obturad")) return "obturado";
  if (s === "perdida_por_caries") return "perdida_caries";
  return s;
}
