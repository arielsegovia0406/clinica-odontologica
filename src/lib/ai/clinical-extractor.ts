import { z } from "zod";

/**
 * Interchangeable clinical extractor — AI proposes, dentist disposes.
 * Output must always validate against Zod before reaching the UI.
 */
export const clinicalExtractionSchema = z.object({
  hallazgos: z.array(
    z.object({
      piezaFdi: z.number().int(),
      cara: z
        .enum([
          "vestibular",
          "lingual",
          "palatino",
          "mesial",
          "distal",
          "oclusal",
          "incisal",
        ])
        .optional(),
      estado: z.string(),
      confianza: z.number().min(0).max(1),
    }),
  ),
  diagnosticosSugeridos: z
    .array(
      z.object({
        descripcion: z.string(),
        cie10: z.string().nullable(),
        confianza: z.number().min(0).max(1),
      }),
    )
    .default([]),
  comandos: z
    .array(
      z.object({
        tipo: z.enum(["corregir_anterior", "borrar_pieza", "repetir"]),
        piezaFdi: z.number().int().optional(),
      }),
    )
    .default([]),
});

export type ClinicalExtraction = z.infer<typeof clinicalExtractionSchema>;

export type ExtractorInput = {
  transcription: string;
  patientAgeYears: number;
  denticion: "permanente" | "temporal" | "mixta";
};

export interface ClinicalExtractor {
  readonly name: string;
  extract(input: ExtractorInput): Promise<ClinicalExtraction>;
}

export class StubClinicalExtractor implements ClinicalExtractor {
  readonly name = "stub";

  async extract(): Promise<ClinicalExtraction> {
    throw new Error("LLM extractor not configured — wire ClinicalExtractor in Phase 4");
  }
}
