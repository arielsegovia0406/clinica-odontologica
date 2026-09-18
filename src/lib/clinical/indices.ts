import {
  FDI_PERMANENTE,
  FDI_TEMPORAL,
  type DienteState,
  type OdontogramaSnapshot,
} from "./odontograma";
import {
  CPO_EXCLUIR_TERCEROS,
  IHOS_DIENTES_INDICE,
  type IhosScoreCalculo,
  type IhosScoreGingivitis,
  type IhosScorePlaca,
} from "./indices-config";

export type CpoCeoResult = {
  c: number;
  p: number;
  o: number;
  cpoD: number;
  cTemporal: number;
  eTemporal: number;
  oTemporal: number;
  ceoD: number;
};

export type IhosPiezaExaminada = {
  principal: number;
  usada: number;
  placa: IhosScorePlaca;
  calculo: IhosScoreCalculo;
  gingivitis: IhosScoreGingivitis;
};

export type IhosResult = {
  ihosPlaca: number | null;
  ihosCalculo: number | null;
  ihosGingivitis: number | null;
  ohiS: number | null;
  n: number;
};

function isPermanentFdi(fdi: number): boolean {
  return (FDI_PERMANENTE as readonly number[]).includes(fdi);
}

function isTemporalFdi(fdi: number): boolean {
  return (FDI_TEMPORAL as readonly number[]).includes(fdi);
}

function isThirdMolar(fdi: number): boolean {
  return fdi === 18 || fdi === 28 || fdi === 38 || fdi === 48;
}

function hasCara(
  d: DienteState,
  estados: ReadonlyArray<DienteState["caras"][number]["estado"]>,
): boolean {
  return d.caras.some((c) => estados.includes(c.estado));
}

type Bucket = "C" | "P" | "O" | "c" | "e" | "o" | null;

/** Clasifica una pieza según docs/INDICES.md (prioridad pérdida > caries > obturado). */
export function classifyToothForIndex(d: DienteState): Bucket {
  const fdi = d.piezaFdi;
  const permanente = isPermanentFdi(fdi);
  const temporal = isTemporalFdi(fdi);
  if (!permanente && !temporal) return null;

  if (permanente && CPO_EXCLUIR_TERCEROS && isThirdMolar(fdi)) return null;

  if (permanente) {
    if (d.estadoPieza === "perdida_caries") return "P";
    if (
      d.estadoPieza === "ausente" ||
      d.estadoPieza === "perdida_otra_causa"
    ) {
      return null;
    }
    if (
      d.estadoPieza === "extraccion_indicada" ||
      d.estadoPieza === "endodoncia_indicada" ||
      hasCara(d, ["caries"])
    ) {
      return "C";
    }
    if (
      d.estadoPieza === "corona_realizada" ||
      d.estadoPieza === "endodoncia_realizada" ||
      d.estadoPieza === "corona_indicada" ||
      hasCara(d, ["obturado"])
    ) {
      return "O";
    }
    return null;
  }

  // temporal
  if (
    d.estadoPieza === "perdida_caries" ||
    d.estadoPieza === "extraccion_indicada"
  ) {
    return "e";
  }
  if (d.estadoPieza === "ausente" || d.estadoPieza === "perdida_otra_causa") {
    return null;
  }
  if (
    d.estadoPieza === "endodoncia_indicada" ||
    hasCara(d, ["caries"])
  ) {
    return "c";
  }
  if (
    d.estadoPieza === "corona_realizada" ||
    d.estadoPieza === "endodoncia_realizada" ||
    d.estadoPieza === "corona_indicada" ||
    hasCara(d, ["obturado"])
  ) {
    return "o";
  }
  return null;
}

export function computeCpoCeoFromOdontograma(
  snap: OdontogramaSnapshot,
): CpoCeoResult {
  let c = 0;
  let p = 0;
  let o = 0;
  let cTemporal = 0;
  let eTemporal = 0;
  let oTemporal = 0;

  for (const d of snap.dientes) {
    const bucket = classifyToothForIndex(d);
    switch (bucket) {
      case "C":
        c += 1;
        break;
      case "P":
        p += 1;
        break;
      case "O":
        o += 1;
        break;
      case "c":
        cTemporal += 1;
        break;
      case "e":
        eTemporal += 1;
        break;
      case "o":
        oTemporal += 1;
        break;
      default:
        break;
    }
  }

  return {
    c,
    p,
    o,
    cpoD: c + p + o,
    cTemporal,
    eTemporal,
    oTemporal,
    ceoD: cTemporal + eTemporal + oTemporal,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeIhos(piezas: IhosPiezaExaminada[]): IhosResult {
  if (piezas.length === 0) {
    return {
      ihosPlaca: null,
      ihosCalculo: null,
      ihosGingivitis: null,
      ohiS: null,
      n: 0,
    };
  }
  const n = piezas.length;
  const sumP = piezas.reduce((a, x) => a + x.placa, 0);
  const sumC = piezas.reduce((a, x) => a + x.calculo, 0);
  const sumG = piezas.reduce((a, x) => a + x.gingivitis, 0);
  const ihosPlaca = round2(sumP / n);
  const ihosCalculo = round2(sumC / n);
  const ihosGingivitis = round2(sumG / n);
  return {
    ihosPlaca,
    ihosCalculo,
    ihosGingivitis,
    ohiS: round2(ihosPlaca + ihosCalculo),
    n,
  };
}

/** Resuelve pieza a usar para cada índice IHOS según presencia en odontograma. */
export function resolveIhosTeeth(
  presentFdis: ReadonlySet<number>,
): Array<{ principal: number; usada: number }> {
  return IHOS_DIENTES_INDICE.map((row) => {
    if (presentFdis.has(row.principal)) {
      return { principal: row.principal, usada: row.principal };
    }
    for (const s of row.sustitutos) {
      if (presentFdis.has(s)) {
        return { principal: row.principal, usada: s };
      }
    }
    return { principal: row.principal, usada: row.principal };
  });
}

export function emptyIhosPiezas(
  presentFdis: ReadonlySet<number>,
): IhosPiezaExaminada[] {
  return resolveIhosTeeth(presentFdis).map((t) => ({
    ...t,
    placa: 0,
    calculo: 0,
    gingivitis: 0,
  }));
}
