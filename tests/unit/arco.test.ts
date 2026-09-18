import { describe, expect, it } from "vitest";
import {
  anonymizedPacienteFields,
  canExecuteEliminacion,
  canExecuteExportacion,
  isRetencionVigente,
  nextEstadoTrasAprobar,
  nextEstadoTrasRechazar,
} from "@/lib/clinical/arco";
import { can } from "@/lib/clinical/permissions";
import { toExportValue } from "@/lib/arco/export-shape";
import { hashUtf8 } from "@/lib/arco/storage";

describe("ARCO rules F6", () => {
  const now = new Date("2026-09-11T12:00:00Z");

  it("blocks eliminación while retencion_hasta is future", () => {
    expect(
      isRetencionVigente(new Date("2027-01-01T00:00:00Z"), now),
    ).toBe(true);
    expect(isRetencionVigente(null, now)).toBe(false);
    expect(
      isRetencionVigente(new Date("2020-01-01T00:00:00Z"), now),
    ).toBe(false);

    const blocked = canExecuteEliminacion({
      estado: "aprobada_admin",
      tipo: "eliminacion",
      retencionHasta: new Date("2027-01-01T00:00:00Z"),
      now,
    });
    expect(blocked.ok).toBe(false);

    const allowed = canExecuteEliminacion({
      estado: "aprobada_admin",
      tipo: "eliminacion",
      retencionHasta: null,
      now,
    });
    expect(allowed.ok).toBe(true);
  });

  it("requires aprobada_admin before execute", () => {
    expect(
      canExecuteExportacion({ estado: "solicitada", tipo: "exportacion" }).ok,
    ).toBe(false);
    expect(
      canExecuteExportacion({
        estado: "aprobada_admin",
        tipo: "exportacion",
      }).ok,
    ).toBe(true);
    expect(
      canExecuteEliminacion({
        estado: "solicitada",
        tipo: "eliminacion",
        retencionHasta: null,
      }).ok,
    ).toBe(false);
  });

  it("transitions solicitar → aprobar/rechazar", () => {
    expect(nextEstadoTrasAprobar("solicitada")).toBe("aprobada_admin");
    expect(nextEstadoTrasAprobar("ejecutada")).toBeNull();
    expect(nextEstadoTrasRechazar("solicitada")).toBe("rechazada");
  });

  it("anonymizes with unique ARCO document id", () => {
    const a = anonymizedPacienteFields("arco_abc123def456");
    expect(a.nombres).toBe("ELIMINADO");
    expect(a.numeroDocumento.startsWith("ARCO-")).toBe(true);
    expect(a.email).toBeNull();
  });

  it("only admin has arco_admin", () => {
    expect(can("admin", "arco_admin")).toBe(true);
    expect(can("odontologo", "arco_admin")).toBe(false);
    expect(can("auxiliar", "arco_solicitar")).toBe(true);
    expect(can("auxiliar", "arco_admin")).toBe(false);
  });

  it("serializes dates in export payload", () => {
    const out = toExportValue({
      when: new Date("2026-09-11T12:00:00.000Z"),
      nested: { n: 1 },
    }) as { when: string; nested: { n: number } };
    expect(out.when).toBe("2026-09-11T12:00:00.000Z");
    expect(out.nested.n).toBe(1);
  });

  it("hashes export body stably", () => {
    expect(hashUtf8('{"a":1}\n')).toHaveLength(64);
  });
});
