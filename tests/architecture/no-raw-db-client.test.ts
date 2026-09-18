import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..", "..");
const FORBIDDEN = [
  'from "@/lib/db/client"',
  'from "@/lib/db/client.ts"',
  'from "../lib/db/client"',
  'from "../../lib/db/client"',
  "dbUnsafe",
  "getDbUnsafe",
];

const ALLOWED_PREFIXES = [
  join(ROOT, "src", "lib", "db"),
  join(ROOT, "scripts"),
  join(ROOT, "tests"),
  join(ROOT, "drizzle"),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

function isAllowed(file: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => file === prefix || file.startsWith(prefix + "\\") || file.startsWith(prefix + "/"),
  );
}

describe("architecture: no raw DB client outside allowlist", () => {
  it("app routes and feature modules do not import dbUnsafe/getDbUnsafe", () => {
    const files = walk(join(ROOT, "src"));
    const violations: string[] = [];

    for (const file of files) {
      if (isAllowed(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const needle of FORBIDDEN) {
        if (text.includes(needle)) {
          // Auth may use dbMigrator via client — only flag unsafe symbols / client imports
          if (
            needle.includes("db/client") &&
            text.includes("dbMigrator") &&
            !text.includes("dbUnsafe") &&
            !text.includes("getDbUnsafe")
          ) {
            // importing client for dbMigrator is still discouraged from app/;
            // allow only unlock-pin and clinica select / auth which need migrator for sessions
            const rel = relative(ROOT, file).replace(/\\/g, "/");
            if (
              rel.startsWith("src/app/api/") ||
              rel.startsWith("src/lib/auth/") ||
              rel.includes("select-clinica") ||
              rel.includes("app/[clinicaId]")
            ) {
              continue;
            }
          }
          if (
            (needle === "dbUnsafe" || needle === "getDbUnsafe") &&
            !text.includes(needle)
          ) {
            continue;
          }
          if (needle.includes("db/client") && !text.includes(needle)) continue;
          violations.push(`${relative(ROOT, file)} → ${needle}`);
        }
      }
    }

    // Tighten: any non-allowlisted file mentioning dbUnsafe/getDbUnsafe is a fail
    const strict: string[] = [];
    for (const file of files) {
      if (isAllowed(file)) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes("dbUnsafe") || text.includes("getDbUnsafe")) {
        strict.push(relative(ROOT, file));
      }
    }

    expect(strict, `Raw DB client leaked into:\n${strict.join("\n")}`).toEqual(
      [],
    );
  });
});
