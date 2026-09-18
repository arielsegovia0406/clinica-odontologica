import { describe, expect, it } from "vitest";
import {
  applyTransition,
  arePiezasContiguasMismoArco,
  emptyOdontograma,
  undoApplied,
  OdontogramaValidationError,
} from "@/lib/clinical/odontograma";
import { sugerirDenticionPorEdad } from "@/lib/clinical/odontograma-config";
import { can } from "@/lib/clinical/permissions";

describe("denticion por edad", () => {
  it("sugiere temporal / mixta / permanente", () => {
    expect(sugerirDenticionPorEdad(4)).toBe("temporal");
    expect(sugerirDenticionPorEdad(8)).toBe("mixta");
    expect(sugerirDenticionPorEdad(13)).toBe("permanente");
  });
});

describe("odontograma transitions §6", () => {
  it("starts empty — no silent sano", () => {
    expect(emptyOdontograma("permanente").dientes).toEqual([]);
  });

  it("rejects FDI outside denticion", () => {
    expect(() =>
      applyTransition(emptyOdontograma("permanente"), {
        type: "set_estado_pieza",
        piezaFdi: 51,
        estadoPieza: "sano",
      }),
    ).toThrow(OdontogramaValidationError);
  });

  it("clears caras when marking ausente", () => {
    let snap = emptyOdontograma("permanente");
    snap = applyTransition(snap, {
      type: "set_cara",
      piezaFdi: 16,
      cara: "oclusal",
      estado: "caries",
    }).after;
    snap = applyTransition(snap, {
      type: "set_estado_pieza",
      piezaFdi: 16,
      estadoPieza: "ausente",
    }).after;
    const d = snap.dientes.find((x) => x.piezaFdi === 16)!;
    expect(d.caras).toEqual([]);
    expect(d.estadoPieza).toBe("ausente");
  });

  it("rejects palatino on lower arch", () => {
    expect(() =>
      applyTransition(emptyOdontograma("permanente"), {
        type: "set_cara",
        piezaFdi: 36,
        cara: "palatino",
        estado: "caries",
      }),
    ).toThrow(/Palatino/);
  });

  it("rejects sellante on non-occlusal", () => {
    expect(() =>
      applyTransition(emptyOdontograma("permanente"), {
        type: "set_cara",
        piezaFdi: 16,
        cara: "mesial",
        estado: "sellante_necesario",
      }),
    ).toThrow(/Sellante/);
  });

  it("undo restores previous snapshot", () => {
    const start = emptyOdontograma("permanente");
    const applied = applyTransition(start, {
      type: "set_estado_pieza",
      piezaFdi: 11,
      estadoPieza: "sano",
    });
    expect(applied.after.dientes).toHaveLength(1);
    expect(undoApplied(applied).dientes).toHaveLength(0);
  });

  it("promote copies from reference only", () => {
    const reference = applyTransition(emptyOdontograma("permanente"), {
      type: "set_cara",
      piezaFdi: 26,
      cara: "oclusal",
      estado: "obturado",
    }).after;
    const current = emptyOdontograma("permanente");
    const promoted = applyTransition(
      current,
      { type: "promote_from_reference", piezaFdi: 26 },
      { reference },
    ).after;
    expect(promoted.dientes[0]?.caras[0]?.estado).toBe("obturado");
    expect(() =>
      applyTransition(
        current,
        { type: "promote_from_reference", piezaFdi: 11 },
        { reference },
      ),
    ).toThrow(/referencia/);
  });

  it("blocks transitions when immutable", () => {
    expect(() =>
      applyTransition(
        emptyOdontograma("permanente"),
        { type: "set_estado_pieza", piezaFdi: 11, estadoPieza: "sano" },
        { immutable: true },
      ),
    ).toThrow(/inmutable/i);
  });

  it("validates contiguous tramo on same arch", () => {
    expect(arePiezasContiguasMismoArco([14, 15, 16])).toBe(true);
    expect(arePiezasContiguasMismoArco([14, 16])).toBe(false);
    expect(arePiezasContiguasMismoArco([14, 24])).toBe(false);
  });
});

describe("odontograma permissions", () => {
  it("allows all three roles to write odontograma", () => {
    expect(can("odontologo", "odontograma_write")).toBe(true);
    expect(can("auxiliar", "odontograma_write")).toBe(true);
    expect(can("admin", "odontograma_write")).toBe(true);
  });

  it("keeps anamnesis blocked for auxiliar", () => {
    expect(can("auxiliar", "anamnesis_read")).toBe(false);
  });
});
