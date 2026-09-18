import { describe, expect, it } from "vitest";
import {
  classifyToothForIndex,
  computeCpoCeoFromOdontograma,
  computeIhos,
} from "@/lib/clinical/indices";
import {
  applyTransition,
  emptyOdontograma,
} from "@/lib/clinical/odontograma";

describe("CPO-D / ceo-d from odontograma", () => {
  it("counts permanent caries/obturado/perdida", () => {
    let snap = emptyOdontograma("permanente");
    snap = applyTransition(snap, {
      type: "set_cara",
      piezaFdi: 16,
      cara: "oclusal",
      estado: "caries",
    }).after;
    snap = applyTransition(snap, {
      type: "set_cara",
      piezaFdi: 26,
      cara: "oclusal",
      estado: "obturado",
    }).after;
    snap = applyTransition(snap, {
      type: "set_estado_pieza",
      piezaFdi: 36,
      estadoPieza: "perdida_caries",
    }).after;
    const r = computeCpoCeoFromOdontograma(snap);
    expect(r).toMatchObject({ c: 1, o: 1, p: 1, cpoD: 3 });
  });

  it("does not count ausente as P", () => {
    const d = applyTransition(emptyOdontograma("permanente"), {
      type: "set_estado_pieza",
      piezaFdi: 46,
      estadoPieza: "ausente",
    }).after.dientes[0]!;
    expect(classifyToothForIndex(d)).toBeNull();
  });

  it("counts temporal extraccion_indicada as e", () => {
    const snap = applyTransition(emptyOdontograma("temporal"), {
      type: "set_estado_pieza",
      piezaFdi: 54,
      estadoPieza: "extraccion_indicada",
    }).after;
    expect(computeCpoCeoFromOdontograma(snap).eTemporal).toBe(1);
    expect(computeCpoCeoFromOdontograma(snap).ceoD).toBe(1);
  });
});

describe("IHOS Greene & Vermillion", () => {
  it("averages placa and calculo", () => {
    const r = computeIhos([
      { principal: 16, usada: 16, placa: 2, calculo: 1, gingivitis: 1 },
      { principal: 11, usada: 11, placa: 0, calculo: 0, gingivitis: 0 },
    ]);
    expect(r.n).toBe(2);
    expect(r.ihosPlaca).toBe(1);
    expect(r.ihosCalculo).toBe(0.5);
    expect(r.ohiS).toBe(1.5);
  });
});
