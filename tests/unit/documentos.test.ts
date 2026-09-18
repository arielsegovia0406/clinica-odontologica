import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  buildForm033SummaryPdf,
  diagnosticosForPdf,
} from "@/lib/documents/form-033-summary";
import { DrawnSignatureProvider } from "@/lib/signatures/provider";
import { can } from "@/lib/clinical/permissions";

describe("documentos F5", () => {
  it("does not invent CIE-10 codes", () => {
    const rows = diagnosticosForPdf([
      { descripcion: "Caries 16", cie10: null, confirmado: true },
      { descripcion: "Draft", cie10: "K02.1", confirmado: false },
      { descripcion: "Confirmed", cie10: "  K02.1  ", confirmado: true },
    ]);
    expect(rows).toEqual([
      { descripcion: "Caries 16", cie10: null },
      { descripcion: "Confirmed", cie10: "K02.1" },
    ]);
  });

  it("builds a non-empty PDF buffer", async () => {
    const pdf = await buildForm033SummaryPdf({
      clinicaNombre: "Clínica Test",
      paciente: {
        nombres: "Ana",
        apellidos: "Pérez",
        tipoDocumento: "cedula",
        numeroDocumento: "1700000001",
        fechaNacimiento: "1990-01-01",
        sexo: "femenino",
      },
      visita: {
        id: "vis_test",
        motivoConsulta: "Control",
        enfermedadActual: null,
        signosVitales: { temperatura: 36.5 },
        denticion: "permanente",
      },
      odontogramaResumen: ["FDI 16 oclusal: caries"],
      indices: { cpoD: 1, ceoD: 0, ihosPlaca: "0.50", ihosCalculo: "0.00" },
      consentimientos: [
        {
          tipo: "tratamiento_datos",
          version: "td-2026-09-v1",
          aceptadoEn: "2026-09-11T12:00:00.000Z",
        },
      ],
      diagnosticos: [],
      firma: {
        profesionalNombre: "Dra. Test",
        rol: "odontologo",
        tipo: "dibujada",
        referencia: "drawn:test",
        firmadoEn: "2026-09-11T12:00:00.000Z",
      },
    });
    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });

  it("drawn signature references content hash", async () => {
    const hash = createHash("sha256").update("payload").digest("hex");
    const sig = await new DrawnSignatureProvider().sign({
      visitaId: "vis_1",
      userId: "user_1",
      contentHash: hash,
    });
    expect(sig.tipo).toBe("dibujada");
    expect(sig.referencia).toContain(hash.slice(0, 12));
  });

  it("auxiliar cannot firmar", () => {
    expect(can("auxiliar", "documento_firmar")).toBe(false);
    expect(can("odontologo", "documento_firmar")).toBe(true);
    expect(can("auxiliar", "documento_read")).toBe(true);
  });
});
