import {
  FDI_PERMANENTE,
  FDI_TEMPORAL,
  type CaraDental,
  type Denticion,
  type DienteState,
  type EstadoCara,
  type OdontogramaSnapshot,
  fdiSetForDenticion,
} from "@/lib/clinical/odontograma";

/** Colores de hallazgo — alto contraste sobre dientes claros / fondo negro. */
const CARA_COLOR: Record<EstadoCara, string> = {
  caries: "#f87171",
  obturado: "#60a5fa",
  sellante_necesario: "#fbbf24",
  sellante_realizado: "#4ade80",
};

const FILL_EMPTY = "#e8f7f5";
const FILL_GHOST = "#9bb8b4";
const STROKE_DEFAULT = "#84bac9";
const STROKE_SELECTED = "#17bcbc";

function caraFill(
  diente: DienteState | undefined,
  cara: CaraDental,
  ghost: boolean,
): string {
  const estado = diente?.caras.find((c) => c.cara === cara)?.estado;
  if (!estado) return ghost ? FILL_GHOST : FILL_EMPTY;
  return CARA_COLOR[estado];
}

function hasEstadoFill(fill: string): boolean {
  return fill !== FILL_EMPTY && fill !== FILL_GHOST;
}

type ToothProps = {
  piezaFdi: number;
  diente?: DienteState;
  selected: boolean;
  ghost?: boolean;
  onSelect: (piezaFdi: number) => void;
};

export function ToothSvg({
  piezaFdi,
  diente,
  selected,
  ghost = false,
  onSelect,
}: ToothProps) {
  const opacity = ghost ? 0.55 : 1;
  const stroke = selected ? STROKE_SELECTED : STROKE_DEFAULT;
  const strokeWidth = selected ? 2.2 : 1.2;
  const ausente =
    diente?.estadoPieza === "ausente" ||
    diente?.estadoPieza === "perdida_caries" ||
    diente?.estadoPieza === "perdida_otra_causa";

  const oclusalFill = caraFill(diente, "oclusal", ghost);
  const incisalFill = caraFill(diente, "incisal", ghost);
  const centroFill = hasEstadoFill(oclusalFill) ? oclusalFill : incisalFill;
  const lingualFill = caraFill(diente, "lingual", ghost);
  const palatinoFill = caraFill(diente, "palatino", ghost);
  const inferiorFill = hasEstadoFill(lingualFill) ? lingualFill : palatinoFill;

  return (
    <button
      type="button"
      onClick={() => onSelect(piezaFdi)}
      className={`inline-flex min-h-14 min-w-12 flex-col items-center gap-1 rounded-md p-1 ${
        selected
          ? "bg-[color-mix(in_srgb,#17bcbc_18%,transparent)] ring-2 ring-[var(--clinic-cyan)]"
          : "hover:bg-[color-mix(in_srgb,#84bac9_12%,transparent)]"
      }`}
      aria-label={`Pieza ${piezaFdi}`}
      aria-pressed={selected}
    >
      <svg
        viewBox="0 0 40 40"
        width="44"
        height="44"
        className="shrink-0"
        style={{ opacity }}
        aria-hidden
      >
        {ausente ? (
          <line
            x1="8"
            y1="6"
            x2="32"
            y2="34"
            stroke="#f87171"
            strokeWidth="3"
          />
        ) : (
          <>
            <polygon
              points="8,2 32,2 28,14 12,14"
              fill={caraFill(diente, "vestibular", ghost)}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <polygon
              points="12,14 28,14 24,26 16,26"
              fill={centroFill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <polygon
              points="4,14 12,14 16,26 8,38"
              fill={caraFill(diente, "mesial", ghost)}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <polygon
              points="28,14 36,14 32,38 24,26"
              fill={caraFill(diente, "distal", ghost)}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
            <polygon
              points="8,38 16,26 24,26 32,38"
              fill={inferiorFill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </>
        )}
      </svg>
      <span className="font-mono text-sm font-semibold leading-none text-[var(--clinic-mint)]">
        {piezaFdi}
      </span>
      {diente?.estadoPieza && diente.estadoPieza !== "sano" ? (
        <span className="max-w-16 truncate text-[10px] leading-tight text-[var(--clinic-sky)]">
          {diente.estadoPieza.replaceAll("_", " ")}
        </span>
      ) : null}
    </button>
  );
}

function ArchRow({
  fdis,
  snapshot,
  selected,
  ghost,
  onSelect,
}: {
  fdis: number[];
  snapshot: OdontogramaSnapshot;
  selected: number | null;
  ghost?: boolean;
  onSelect: (n: number) => void;
}) {
  const map = new Map(snapshot.dientes.map((d) => [d.piezaFdi, d]));
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {fdis.map((fdi) => (
        <ToothSvg
          key={fdi}
          piezaFdi={fdi}
          diente={map.get(fdi)}
          selected={selected === fdi}
          ghost={ghost}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function archesFor(denticion: Denticion) {
  const set = fdiSetForDenticion(denticion);
  const filter = (list: readonly number[]) => list.filter((n) => set.has(n));
  return {
    upperRight: filter([18, 17, 16, 15, 14, 13, 12, 11, 55, 54, 53, 52, 51]),
    upperLeft: filter([21, 22, 23, 24, 25, 26, 27, 28, 61, 62, 63, 64, 65]),
    lowerLeft: filter([31, 32, 33, 34, 35, 36, 37, 38, 71, 72, 73, 74, 75]),
    lowerRight: filter([48, 47, 46, 45, 44, 43, 42, 41, 85, 84, 83, 82, 81]),
  };
}

type GridProps = {
  snapshot: OdontogramaSnapshot;
  selected: number | null;
  onSelect: (piezaFdi: number) => void;
  ghost?: boolean;
  title?: string;
};

export function OdontogramaGrid({
  snapshot,
  selected,
  onSelect,
  ghost,
  title,
}: GridProps) {
  const arches = archesFor(snapshot.denticion);
  return (
    <div className="space-y-4">
      {title ? (
        <h3 className="text-sm font-medium tracking-wide text-[var(--clinic-aqua)] uppercase">
          {title}
        </h3>
      ) : null}
      <div className="rounded-xl border border-[var(--clinic-steel)]/30 bg-[#030506] p-3 sm:p-4">
        <ArchRow
          fdis={[...arches.upperRight, ...arches.upperLeft]}
          snapshot={snapshot}
          selected={selected}
          ghost={ghost}
          onSelect={onSelect}
        />
        <div className="my-3 border-t border-[var(--clinic-steel)]/25" />
        <ArchRow
          fdis={[...arches.lowerRight, ...arches.lowerLeft]}
          snapshot={snapshot}
          selected={selected}
          ghost={ghost}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

export const ALL_FDI_LABEL = {
  permanente: FDI_PERMANENTE.length,
  temporal: FDI_TEMPORAL.length,
};
