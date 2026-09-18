import { randomUUID } from "node:crypto";

/** Stable text PKs for clinical rows. */
export function newId(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}
