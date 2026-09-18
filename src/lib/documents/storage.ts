import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const ROOT = resolve(process.cwd(), "storage", "documentos");

export function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function saveDocumentPdf(input: {
  clinicaId: string;
  visitaId: string;
  tipo: string;
  pdf: Buffer;
}): Promise<{ rutaStorage: string; contentHash: string }> {
  const contentHash = hashBuffer(input.pdf);
  const dir = join(ROOT, input.clinicaId, input.visitaId);
  await mkdir(dir, { recursive: true });
  const filename = `${input.tipo}-${contentHash.slice(0, 16)}.pdf`;
  const abs = join(dir, filename);
  await writeFile(abs, input.pdf);
  const rutaStorage = join(input.clinicaId, input.visitaId, filename).replace(
    /\\/g,
    "/",
  );
  return { rutaStorage, contentHash };
}

/**
 * Resolve a stored relative path under storage/documentos — rejects path traversal.
 */
export async function readDocumentPdf(
  clinicaId: string,
  rutaStorage: string,
): Promise<Buffer> {
  const normalized = rutaStorage.replace(/\\/g, "/");
  if (
    normalized.includes("..") ||
    !normalized.startsWith(`${clinicaId}/`)
  ) {
    throw new Error("Ruta de documento inválida");
  }
  const abs = resolve(ROOT, ...normalized.split("/"));
  const rootResolved = resolve(ROOT) + sep;
  if (!abs.startsWith(rootResolved) && abs !== resolve(ROOT)) {
    throw new Error("Ruta de documento fuera de almacén");
  }
  return readFile(abs);
}
