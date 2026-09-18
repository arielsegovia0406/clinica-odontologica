import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  hashPin,
  verifyPin,
} from "@/lib/auth/password";

describe("argon2id password/PIN", () => {
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("Demo1234!");
    expect(h.startsWith("$argon2")).toBe(true);
    expect(await verifyPassword({ password: "Demo1234!", hash: h })).toBe(true);
    expect(await verifyPassword({ password: "wrong", hash: h })).toBe(false);
  });

  it("hashes and verifies PINs", async () => {
    const h = await hashPin("1234");
    expect(await verifyPin("1234", h)).toBe(true);
    expect(await verifyPin("9999", h)).toBe(false);
  });

  it("rejects non-digit PINs", async () => {
    await expect(hashPin("12ab")).rejects.toThrow(/PIN/);
  });
});
