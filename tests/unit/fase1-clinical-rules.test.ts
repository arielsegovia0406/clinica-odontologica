import { describe, expect, it } from "vitest";
import { nextAnamnesisVersion } from "@/lib/clinical/anamnesis-version";
import { can, assertCan } from "@/lib/clinical/permissions";
import {
  canEnableDictado,
  canStartClinicalCare,
  findVigenteConsent,
  hasTratamientoDatosVigente,
} from "@/lib/clinical/consent-rules";
import { validateCedula } from "@/lib/validation/cedula";
import { getLatestConsentText } from "@/lib/consent/texts";
import { pacienteCreateSchema } from "@/lib/validation/paciente";

describe("anamnesis versioning", () => {
  it("starts at 1 when empty", () => {
    expect(nextAnamnesisVersion([])).toBe(1);
  });

  it("increments from max existing version", () => {
    expect(nextAnamnesisVersion([1, 2, 3])).toBe(4);
    expect(nextAnamnesisVersion([1, 5, 2])).toBe(6);
  });
});

describe("auxiliar permissions", () => {
  it("allows patient and consent and vitals", () => {
    expect(can("auxiliar", "paciente_write")).toBe(true);
    expect(can("auxiliar", "consentimiento_write")).toBe(true);
    expect(can("auxiliar", "signos_vitales_write")).toBe(true);
    expect(can("auxiliar", "visita_borrador")).toBe(true);
  });

  it("denies full anamnesis read and write", () => {
    expect(can("auxiliar", "anamnesis_read")).toBe(false);
    expect(can("auxiliar", "anamnesis_write")).toBe(false);
    expect(() => assertCan("auxiliar", "anamnesis_read")).toThrow(/Forbidden/);
  });

  it("allows odontologo and admin anamnesis", () => {
    expect(can("odontologo", "anamnesis_read")).toBe(true);
    expect(can("admin", "anamnesis_write")).toBe(true);
  });
});

describe("consent rules", () => {
  const now = new Date("2026-09-01T12:00:00Z");

  it("requires vigente tratamiento_datos to start clinical care", () => {
    expect(canStartClinicalCare([])).toBe(false);
    expect(
      canStartClinicalCare([
        {
          tipo: "tratamiento_datos",
          aceptadoEn: now,
          revocadoEn: null,
        },
      ]),
    ).toBe(true);
    expect(
      canStartClinicalCare([
        {
          tipo: "tratamiento_datos",
          aceptadoEn: now,
          revocadoEn: new Date("2026-09-02T12:00:00Z"),
        },
      ]),
    ).toBe(false);
  });

  it("dictado requires grabacion_audio vigente", () => {
    expect(canEnableDictado([])).toBe(false);
    expect(
      canEnableDictado([
        {
          tipo: "grabacion_audio",
          aceptadoEn: now,
          revocadoEn: null,
        },
      ]),
    ).toBe(true);
  });

  it("picks latest non-revoked consent of a type", () => {
    const vigente = findVigenteConsent(
      [
        {
          tipo: "tratamiento_datos",
          aceptadoEn: "2026-01-01",
          revocadoEn: null,
        },
        {
          tipo: "tratamiento_datos",
          aceptadoEn: "2026-06-01",
          revocadoEn: null,
        },
      ],
      "tratamiento_datos",
    );
    expect(vigente?.aceptadoEn).toBe("2026-06-01");
    expect(hasTratamientoDatosVigente([vigente!])).toBe(true);
  });

  it("exposes provisional consent catalog with hash", () => {
    const td = getLatestConsentText("tratamiento_datos");
    expect(td.version).toMatch(/^td-/);
    expect(td.hash).toHaveLength(64);
    const ga = getLatestConsentText("grabacion_audio");
    expect(ga.version).toMatch(/^ga-/);
  });
});

describe("cedula validation", () => {
  it("accepts valid checksum (seed-compatible)", () => {
    expect(validateCedula("1700000001")).toEqual({ ok: true });
  });

  it("rejects bad format and checksum", () => {
    expect(validateCedula("123").reason).toBe("formato");
    expect(validateCedula("1700000002").reason).toBe("checksum");
  });

  it("paciente schema validates cedula", () => {
    const ok = pacienteCreateSchema.safeParse({
      tipoDocumento: "cedula",
      numeroDocumento: "1700000001",
      nombres: "Ana",
      apellidos: "Pérez",
      fechaNacimiento: "1990-01-15",
      sexo: "femenino",
    });
    expect(ok.success).toBe(true);

    const bad = pacienteCreateSchema.safeParse({
      tipoDocumento: "cedula",
      numeroDocumento: "1700000002",
      nombres: "Ana",
      apellidos: "Pérez",
      fechaNacimiento: "1990-01-15",
      sexo: "femenino",
    });
    expect(bad.success).toBe(false);
  });
});
