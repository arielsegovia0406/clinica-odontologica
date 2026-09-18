import { GRADO_ESCALA, isGradoValor, type GradoValor } from "./odontograma-config";

export type Denticion = "permanente" | "temporal" | "mixta";

export type CaraDental =
  | "vestibular"
  | "lingual"
  | "palatino"
  | "mesial"
  | "distal"
  | "oclusal"
  | "incisal";

export type EstadoCara =
  | "caries"
  | "obturado"
  | "sellante_necesario"
  | "sellante_realizado";

export type EstadoPieza =
  | "sano"
  | "extraccion_indicada"
  | "perdida_caries"
  | "perdida_otra_causa"
  | "ausente"
  | "endodoncia_indicada"
  | "endodoncia_realizada"
  | "corona_indicada"
  | "corona_realizada";

export type CaraState = { cara: CaraDental; estado: EstadoCara };

export type DienteState = {
  piezaFdi: number;
  estadoPieza: EstadoPieza | null;
  endodonciaIndicada: boolean;
  endodonciaRealizada: boolean;
  coronaIndicada: boolean;
  coronaRealizada: boolean;
  movilidad: GradoValor | null;
  recesion: GradoValor | null;
  notas: string | null;
  caras: CaraState[];
};

export type OdontogramaSnapshot = {
  denticion: Denticion;
  dientes: DienteState[];
};

export type OdontogramaErrorCode =
  | "fdi_fuera_denticion"
  | "cara_invalida_arcada"
  | "cara_invalida_tipo_pieza"
  | "sellante_no_oclusal_posterior"
  | "cara_en_pieza_ausente"
  | "grado_invalido"
  | "grado_en_pieza_ausente"
  | "pieza_no_en_referencia"
  | "inmutable";

export class OdontogramaValidationError extends Error {
  readonly code: OdontogramaErrorCode;
  constructor(code: OdontogramaErrorCode, message: string) {
    super(message);
    this.name = "OdontogramaValidationError";
    this.code = code;
  }
}

export const FDI_PERMANENTE = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34,
  35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
] as const;

export const FDI_TEMPORAL = [
  51, 52, 53, 54, 55, 61, 62, 63, 64, 65, 71, 72, 73, 74, 75, 81, 82, 83, 84, 85,
] as const;

export function fdiSetForDenticion(denticion: Denticion): ReadonlySet<number> {
  if (denticion === "permanente") return new Set(FDI_PERMANENTE);
  if (denticion === "temporal") return new Set(FDI_TEMPORAL);
  return new Set([...FDI_PERMANENTE, ...FDI_TEMPORAL]);
}

export function isFdiInDenticion(piezaFdi: number, denticion: Denticion): boolean {
  return fdiSetForDenticion(denticion).has(piezaFdi);
}

export function isUpperArch(piezaFdi: number): boolean {
  const decade = Math.floor(piezaFdi / 10);
  return decade === 1 || decade === 2 || decade === 5 || decade === 6;
}

export function isAnterior(piezaFdi: number): boolean {
  const unit = piezaFdi % 10;
  return unit >= 1 && unit <= 3;
}

export function isPosterior(piezaFdi: number): boolean {
  const unit = piezaFdi % 10;
  return unit >= 4 && unit <= 8;
}

export function isPiezaAusenteOPerdida(estado: EstadoPieza | null): boolean {
  return (
    estado === "ausente" ||
    estado === "perdida_caries" ||
    estado === "perdida_otra_causa" ||
    estado === "extraccion_indicada"
  );
}

export function syncFlagsFromEstado(estado: EstadoPieza | null): Pick<
  DienteState,
  | "endodonciaIndicada"
  | "endodonciaRealizada"
  | "coronaIndicada"
  | "coronaRealizada"
> {
  return {
    endodonciaIndicada: estado === "endodoncia_indicada",
    endodonciaRealizada: estado === "endodoncia_realizada",
    coronaIndicada: estado === "corona_indicada",
    coronaRealizada: estado === "corona_realizada",
  };
}

export function emptyDiente(piezaFdi: number): DienteState {
  return {
    piezaFdi,
    estadoPieza: null,
    endodonciaIndicada: false,
    endodonciaRealizada: false,
    coronaIndicada: false,
    coronaRealizada: false,
    movilidad: null,
    recesion: null,
    notas: null,
    caras: [],
  };
}

export function emptyOdontograma(denticion: Denticion): OdontogramaSnapshot {
  return { denticion, dientes: [] };
}

function assertFdi(piezaFdi: number, denticion: Denticion): void {
  if (!isFdiInDenticion(piezaFdi, denticion)) {
    throw new OdontogramaValidationError(
      "fdi_fuera_denticion",
      `Pieza ${piezaFdi} no pertenece a dentición ${denticion}`,
    );
  }
}

export function assertCaraPermitida(piezaFdi: number, cara: CaraDental): void {
  if (cara === "palatino" && !isUpperArch(piezaFdi)) {
    throw new OdontogramaValidationError(
      "cara_invalida_arcada",
      "Palatino solo en arcada superior",
    );
  }
  if (cara === "lingual" && isUpperArch(piezaFdi)) {
    throw new OdontogramaValidationError(
      "cara_invalida_arcada",
      "Lingual solo en arcada inferior",
    );
  }
  if (cara === "oclusal" && !isPosterior(piezaFdi)) {
    throw new OdontogramaValidationError(
      "cara_invalida_tipo_pieza",
      "Oclusal solo en posteriores",
    );
  }
  if (cara === "incisal" && !isAnterior(piezaFdi)) {
    throw new OdontogramaValidationError(
      "cara_invalida_tipo_pieza",
      "Incisal solo en anteriores",
    );
  }
}

export function assertEstadoCara(
  piezaFdi: number,
  cara: CaraDental,
  estado: EstadoCara,
): void {
  assertCaraPermitida(piezaFdi, cara);
  if (
    (estado === "sellante_necesario" || estado === "sellante_realizado") &&
    !(cara === "oclusal" && isPosterior(piezaFdi))
  ) {
    throw new OdontogramaValidationError(
      "sellante_no_oclusal_posterior",
      "Sellante solo en oclusal de posteriores",
    );
  }
}

function findDiente(
  snap: OdontogramaSnapshot,
  piezaFdi: number,
): DienteState | undefined {
  return snap.dientes.find((d) => d.piezaFdi === piezaFdi);
}

function replaceDiente(
  snap: OdontogramaSnapshot,
  diente: DienteState,
): OdontogramaSnapshot {
  const others = snap.dientes.filter((d) => d.piezaFdi !== diente.piezaFdi);
  return { ...snap, dientes: [...others, diente].sort((a, b) => a.piezaFdi - b.piezaFdi) };
}

export type Transition =
  | {
      type: "set_estado_pieza";
      piezaFdi: number;
      estadoPieza: EstadoPieza | null;
    }
  | {
      type: "set_cara";
      piezaFdi: number;
      cara: CaraDental;
      estado: EstadoCara | null;
    }
  | {
      type: "set_movilidad";
      piezaFdi: number;
      movilidad: GradoValor | null;
    }
  | {
      type: "set_recesion";
      piezaFdi: number;
      recesion: GradoValor | null;
    }
  | {
      type: "set_notas";
      piezaFdi: number;
      notas: string | null;
    }
  | {
      type: "promote_from_reference";
      piezaFdi: number;
    }
  | {
      type: "clear_pieza";
      piezaFdi: number;
    };

export type AppliedTransition = {
  forward: Transition;
  /** Snapshot before applying forward (for undo). */
  before: OdontogramaSnapshot;
  after: OdontogramaSnapshot;
};

export function applyTransition(
  snap: OdontogramaSnapshot,
  transition: Transition,
  opts?: { reference?: OdontogramaSnapshot | null; immutable?: boolean },
): AppliedTransition {
  if (opts?.immutable) {
    throw new OdontogramaValidationError(
      "inmutable",
      "Odontograma inmutable; no se puede editar",
    );
  }

  const before = structuredClone(snap);
  let after: OdontogramaSnapshot;

  switch (transition.type) {
    case "set_estado_pieza": {
      assertFdi(transition.piezaFdi, snap.denticion);
      const current = findDiente(snap, transition.piezaFdi) ?? emptyDiente(transition.piezaFdi);
      const flags = syncFlagsFromEstado(transition.estadoPieza);
      const next: DienteState = {
        ...current,
        estadoPieza: transition.estadoPieza,
        ...flags,
        caras: isPiezaAusenteOPerdida(transition.estadoPieza) ? [] : current.caras,
        movilidad: isPiezaAusenteOPerdida(transition.estadoPieza)
          ? null
          : current.movilidad,
        recesion: isPiezaAusenteOPerdida(transition.estadoPieza)
          ? null
          : current.recesion,
      };
      after =
        transition.estadoPieza == null &&
        next.caras.length === 0 &&
        next.movilidad == null &&
        next.recesion == null &&
        !next.notas
          ? {
              ...snap,
              dientes: snap.dientes.filter((d) => d.piezaFdi !== transition.piezaFdi),
            }
          : replaceDiente(snap, next);
      break;
    }
    case "set_cara": {
      assertFdi(transition.piezaFdi, snap.denticion);
      const current = findDiente(snap, transition.piezaFdi) ?? emptyDiente(transition.piezaFdi);
      if (isPiezaAusenteOPerdida(current.estadoPieza)) {
        throw new OdontogramaValidationError(
          "cara_en_pieza_ausente",
          "No se registran caras en pieza ausente/pérdida/extracción",
        );
      }
      if (transition.estado == null) {
        const next = {
          ...current,
          caras: current.caras.filter((c) => c.cara !== transition.cara),
        };
        after = replaceDiente(snap, next);
      } else {
        assertEstadoCara(transition.piezaFdi, transition.cara, transition.estado);
        const caras = [
          ...current.caras.filter((c) => c.cara !== transition.cara),
          { cara: transition.cara, estado: transition.estado },
        ];
        after = replaceDiente(snap, { ...current, caras });
      }
      break;
    }
    case "set_movilidad": {
      assertFdi(transition.piezaFdi, snap.denticion);
      const current = findDiente(snap, transition.piezaFdi) ?? emptyDiente(transition.piezaFdi);
      if (transition.movilidad != null) {
        if (!isGradoValor(transition.movilidad)) {
          throw new OdontogramaValidationError(
            "grado_invalido",
            `Movilidad fuera de escala ${GRADO_ESCALA.id}`,
          );
        }
        if (isPiezaAusenteOPerdida(current.estadoPieza)) {
          throw new OdontogramaValidationError(
            "grado_en_pieza_ausente",
            "Movilidad no aplica a pieza ausente/pérdida",
          );
        }
      }
      after = replaceDiente(snap, { ...current, movilidad: transition.movilidad });
      break;
    }
    case "set_recesion": {
      assertFdi(transition.piezaFdi, snap.denticion);
      const current = findDiente(snap, transition.piezaFdi) ?? emptyDiente(transition.piezaFdi);
      if (transition.recesion != null) {
        if (!isGradoValor(transition.recesion)) {
          throw new OdontogramaValidationError(
            "grado_invalido",
            `Recesión fuera de escala ${GRADO_ESCALA.id}`,
          );
        }
        if (isPiezaAusenteOPerdida(current.estadoPieza)) {
          throw new OdontogramaValidationError(
            "grado_en_pieza_ausente",
            "Recesión no aplica a pieza ausente/pérdida",
          );
        }
      }
      after = replaceDiente(snap, { ...current, recesion: transition.recesion });
      break;
    }
    case "set_notas": {
      assertFdi(transition.piezaFdi, snap.denticion);
      const current = findDiente(snap, transition.piezaFdi) ?? emptyDiente(transition.piezaFdi);
      after = replaceDiente(snap, {
        ...current,
        notas: transition.notas?.trim() ? transition.notas.trim() : null,
      });
      break;
    }
    case "promote_from_reference": {
      assertFdi(transition.piezaFdi, snap.denticion);
      const ref = opts?.reference;
      const source = ref ? findDiente(ref, transition.piezaFdi) : undefined;
      if (!source) {
        throw new OdontogramaValidationError(
          "pieza_no_en_referencia",
          `La pieza ${transition.piezaFdi} no está en la instantánea de referencia`,
        );
      }
      after = replaceDiente(snap, structuredClone(source));
      break;
    }
    case "clear_pieza": {
      after = {
        ...snap,
        dientes: snap.dientes.filter((d) => d.piezaFdi !== transition.piezaFdi),
      };
      break;
    }
    default: {
      const _exhaustive: never = transition;
      throw new Error(`Unknown transition: ${JSON.stringify(_exhaustive)}`);
    }
  }

  return { forward: transition, before, after };
}

export function undoApplied(applied: AppliedTransition): OdontogramaSnapshot {
  return structuredClone(applied.before);
}

/** Contiguas en el mismo cuadrante/arco (misma decena FDI). */
export function arePiezasContiguasMismoArco(piezas: number[]): boolean {
  if (piezas.length < 2) return false;
  const sorted = [...piezas].sort((a, b) => a - b);
  const decade = Math.floor(sorted[0]! / 10);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    if (Math.floor(p / 10) !== decade) return false;
    if (i > 0 && p !== sorted[i - 1]! + 1) return false;
  }
  return true;
}
