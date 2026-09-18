import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

const ROOT = resolve(process.cwd(), "storage", "arco");

export function hashUtf8(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export async function saveArcoExportJson(input: {
  clinicaId: string;
  solicitudId: string;
  payload: unknown;
}): Promise<{ rutaStorage: string; contentHash: string; body: string }> {
  const body = `${JSON.stringify(input.payload, null, 2)}\n`;
  const contentHash = hashUtf8(body);
  const dir = join(ROOT, input.clinicaId);
  await mkdir(dir, { recursive: true });
  const filename = `${input.solicitudId}.json`;
  await writeFile(join(dir, filename), body, "utf8");
  const rutaStorage = `${input.clinicaId}/${filename}`;
  return { rutaStorage, contentHash, body };
}

export async function readArcoExportJson(
  clinicaId: string,
  rutaStorage: string,
): Promise<Buffer> {
  const normalized = rutaStorage.replace(/\\/g, "/");
  if (
    normalized.includes("..") ||
    !normalized.startsWith(`${clinicaId}/`)
  ) {
    throw new Error("Ruta ARCO inválida");
  }
  const abs = resolve(ROOT, ...normalized.split("/"));
  const rootResolved = resolve(ROOT) + sep;
  if (!abs.startsWith(rootResolved) && abs !== resolve(ROOT)) {
    throw new Error("Ruta ARCO fuera de almacén");
  }
  return readFile(abs);
}
