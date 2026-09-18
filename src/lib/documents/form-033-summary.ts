import PDFDocument from "pdfkit";

export type Form033SummaryInput = {
  clinicaNombre: string;
  paciente: {
    nombres: string;
    apellidos: string;
    tipoDocumento: string;
    numeroDocumento: string;
    fechaNacimiento: string;
    sexo: string;
  };
  visita: {
    id: string;
    motivoConsulta: string | null;
    enfermedadActual: string | null;
    signosVitales: Record<string, unknown> | null;
    denticion: string | null;
  };
  odontogramaResumen: string[];
  indices: {
    cpoD: number;
    ceoD: number;
    ihosPlaca: string | null;
    ihosCalculo: string | null;
  } | null;
  consentimientos: Array<{ tipo: string; version: string; aceptadoEn: string }>;
  diagnosticos: Array<{ descripcion: string; cie10: string | null }>;
  firma: {
    profesionalNombre: string;
    rol: string;
    tipo: string;
    referencia: string;
    firmadoEn: string;
  };
};

function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/**
 * Clinical summary PDF inspired by MSP Form 033 fields — not an official facsimile.
 * Never invents CIE-10 or drug doses; blanks stay blank.
 */
export async function buildForm033SummaryPdf(
  input: Form033SummaryInput,
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: "A4", info: {
    Title: "Resumen clínico odontológico (tipo 033)",
    Author: input.clinicaNombre,
  }});
  const done = collectPdf(doc);

  doc.fontSize(16).text("Resumen clínico odontológico", { align: "center" });
  doc.fontSize(10).fillColor("#444").text(
    "(Documento interno tipo Formulario 033 MSP — no facsímil oficial)",
    { align: "center" },
  );
  doc.moveDown();
  doc.fillColor("#000").fontSize(11);

  doc.font("Helvetica-Bold").text("Clínica: ").font("Helvetica").text(input.clinicaNombre);
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").text("Paciente");
  doc.font("Helvetica").text(
    `${input.paciente.apellidos}, ${input.paciente.nombres}`,
  );
  doc.text(
    `${input.paciente.tipoDocumento} ${input.paciente.numeroDocumento} · Nac. ${input.paciente.fechaNacimiento} · ${input.paciente.sexo}`,
  );
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").text(`Visita ${input.visita.id}`);
  doc.font("Helvetica").text(`Motivo: ${input.visita.motivoConsulta ?? "—"}`);
  doc.text(`Enfermedad actual: ${input.visita.enfermedadActual ?? "—"}`);
  doc.text(`Dentición: ${input.visita.denticion ?? "—"}`);
  if (input.visita.signosVitales) {
    doc.text(`Signos vitales: ${JSON.stringify(input.visita.signosVitales)}`);
  }
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").text("Consentimientos");
  doc.font("Helvetica");
  if (input.consentimientos.length === 0) {
    doc.text("—");
  } else {
    for (const c of input.consentimientos) {
      doc.text(`• ${c.tipo} v${c.version} · ${c.aceptadoEn}`);
    }
  }
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").text("Odontograma (hallazgos registrados)");
  doc.font("Helvetica");
  if (input.odontogramaResumen.length === 0) {
    doc.text("Sin hallazgos registrados (no examinado ≠ sano).");
  } else {
    for (const line of input.odontogramaResumen.slice(0, 40)) {
      doc.text(`• ${line}`);
    }
    if (input.odontogramaResumen.length > 40) {
      doc.text(`… +${input.odontogramaResumen.length - 40} más`);
    }
  }
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").text("Índices");
  doc.font("Helvetica");
  if (!input.indices) {
    doc.text("—");
  } else {
    doc.text(
      `CPO-D: ${input.indices.cpoD} · ceo-d: ${input.indices.ceoD} · IHOS placa: ${input.indices.ihosPlaca ?? "—"} · cálculo: ${input.indices.ihosCalculo ?? "—"}`,
    );
  }
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").text("Diagnósticos confirmados");
  doc.font("Helvetica");
  if (input.diagnosticos.length === 0) {
    doc.text("— (sin códigos inventados)");
  } else {
    for (const d of input.diagnosticos) {
      const cie = d.cie10?.trim() ? ` · CIE-10 ${d.cie10}` : "";
      doc.text(`• ${d.descripcion}${cie}`);
    }
  }
  doc.moveDown(1);

  doc.font("Helvetica-Bold").text("Firma profesional");
  doc.font("Helvetica");
  doc.text(`${input.firma.profesionalNombre} (${input.firma.rol})`);
  doc.text(`Tipo: ${input.firma.tipo}`);
  doc.text(`Referencia: ${input.firma.referencia}`);
  doc.text(`Fecha: ${input.firma.firmadoEn}`);
  doc.moveDown();
  doc.fontSize(8).fillColor("#666").text(
    "Validez MSP de firma electrónica: pendiente de confirmación legal. Ver docs/CUMPLIMIENTO.md.",
  );

  doc.end();
  return done;
}

/** Pure helper for tests: never invent CIE codes in the payload. */
export function diagnosticosForPdf(
  rows: Array<{ descripcion: string; cie10: string | null; confirmado?: boolean }>,
): Array<{ descripcion: string; cie10: string | null }> {
  return rows
    .filter((r) => r.confirmado !== false)
    .map((r) => ({
      descripcion: r.descripcion,
      cie10: r.cie10?.trim() ? r.cie10.trim() : null,
    }));
}
