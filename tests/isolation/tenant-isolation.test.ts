import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { withTenant } from "@/lib/db/with-tenant";
import { getDbMigrator } from "@/lib/db/client";
import { member, pacientes } from "@/lib/db/schema";

const CLINICA_A = "org_clinica_norte";
const CLINICA_B = "org_clinica_sur";
const USER_MULTI = "user_multi";
const USER_ODONTO = "user_odontologo";

describe("tenant isolation (RLS)", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_APP_URL || !process.env.DATABASE_URL) {
      throw new Error("DATABASE_* env vars required for isolation tests");
    }
  });

  it("withTenant(A) cannot read pacientes of clinica B", async () => {
    const fromA = await withTenant(
      { clinicaId: CLINICA_A, userId: USER_MULTI },
      async (tx) =>
        tx
          .select({ id: pacientes.id, clinicaId: pacientes.clinicaId })
          .from(pacientes),
    );

    expect(fromA.every((p) => p.clinicaId === CLINICA_A)).toBe(true);
    expect(fromA.some((p) => p.id === "pac_b_1")).toBe(false);
    expect(fromA.some((p) => p.id === "pac_a_1")).toBe(true);

    const fromB = await withTenant(
      { clinicaId: CLINICA_B, userId: USER_MULTI },
      async (tx) =>
        tx
          .select({ id: pacientes.id, clinicaId: pacientes.clinicaId })
          .from(pacientes),
    );

    expect(fromB.every((p) => p.clinicaId === CLINICA_B)).toBe(true);
    expect(fromB.some((p) => p.id === "pac_a_1")).toBe(false);
  });

  it("rejects withTenant when membership is missing", async () => {
    await expect(
      withTenant({ clinicaId: CLINICA_B, userId: USER_ODONTO }, async (tx) =>
        tx.select().from(pacientes),
      ),
    ).rejects.toThrow(/Forbidden|no active membership/i);
  });

  it("rejects when membership is revoked", async () => {
    const db = getDbMigrator();
    await db
      .update(member)
      .set({ estado: "revocada" })
      .where(eq(member.id, "mem_odonto_a"));

    try {
      await expect(
        withTenant({ clinicaId: CLINICA_A, userId: USER_ODONTO }, async (tx) =>
          tx.select().from(pacientes),
        ),
      ).rejects.toThrow(/Forbidden|no active membership/i);
    } finally {
      await db
        .update(member)
        .set({ estado: "activa" })
        .where(eq(member.id, "mem_odonto_a"));
    }
  });

  it("FORCE RLS: app_user without SET LOCAL sees zero clinical rows", async () => {
    const { dbUnsafe } = await import("@/lib/db/client");
    const rows = await dbUnsafe.select({ id: pacientes.id }).from(pacientes);
    expect(rows).toEqual([]);
  });
});
