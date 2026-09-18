import { describe, expect, it } from "vitest";
import { RuleBasedClinicalExtractor } from "@/lib/ai/rule-based-extractor";
import { mapExtractionToProposals } from "@/lib/clinical/dictado-mapper";

describe("RuleBasedClinicalExtractor", () => {
  const extractor = new RuleBasedClinicalExtractor();

  it("extracts explicit caries with face", async () => {
    const r = await extractor.extract({
      transcription: "Caries en 16 oclusal y 26 obturado",
      patientAgeYears: 30,
      denticion: "permanente",
    });
    expect(r.hallazgos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          piezaFdi: 16,
          cara: "oclusal",
          estado: "caries",
        }),
        expect.objectContaining({
          piezaFdi: 26,
          estado: "obturado",
        }),
      ]),
    );
  });

  it("does not invent healthy teeth", async () => {
    const r = await extractor.extract({
      transcription: "Ausente 36",
      patientAgeYears: 40,
      denticion: "permanente",
    });
    expect(r.hallazgos).toHaveLength(1);
    expect(r.hallazgos[0]?.estado).toBe("ausente");
    expect(r.hallazgos.every((h) => h.estado !== "sano" || h.piezaFdi === 36)).toBe(
      true,
    );
  });

  it("maps borrar comando", async () => {
    const r = await extractor.extract({
      transcription: "borrar pieza 11",
      patientAgeYears: 20,
      denticion: "permanente",
    });
    expect(r.comandos[0]).toEqual({ tipo: "borrar_pieza", piezaFdi: 11 });
  });
});

describe("dictado mapper", () => {
  it("maps cara hallazgos to set_cara transitions", () => {
    const proposals = mapExtractionToProposals({
      hallazgos: [
        { piezaFdi: 16, cara: "oclusal", estado: "caries", confianza: 0.9 },
      ],
      diagnosticosSugeridos: [],
      comandos: [],
    });
    expect(proposals[0]?.transition).toEqual({
      type: "set_cara",
      piezaFdi: 16,
      cara: "oclusal",
      estado: "caries",
    });
  });

  it("rejects unknown estado without inventing", () => {
    const proposals = mapExtractionToProposals({
      hallazgos: [
        { piezaFdi: 21, estado: "magia_dental", confianza: 0.2 },
      ],
      diagnosticosSugeridos: [],
      comandos: [],
    });
    expect(proposals[0]?.transition).toBeNull();
    expect(proposals[0]?.rejectedReason).toMatch(/desconocido/i);
  });
});
