import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { hashPassword, hashPin } from "../src/lib/auth/password";
import { getDbMigrator } from "../src/lib/db/client";
import {
  account,
  member,
  organization,
  pacientes,
  user,
} from "../src/lib/db/schema";

const DEMO_PASSWORD = "Demo1234!";
const DEMO_PIN = "1234";

async function upsertUser(input: {
  id: string;
  name: string;
  email: string;
  pinHash: string;
  passwordHash: string;
}) {
  const db = getDbMigrator();
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, input.email))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(user).values({
      id: input.id,
      name: input.name,
      email: input.email,
      emailVerified: true,
      pinHash: input.pinHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: input.id,
      providerId: "credential",
      userId: input.id,
      password: input.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}

async function main() {
  const db = getDbMigrator();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const pinHash = await hashPin(DEMO_PIN);

  const clinicaA = "org_clinica_norte";
  const clinicaB = "org_clinica_sur";

  await db
    .insert(organization)
    .values([
      {
        id: clinicaA,
        name: "Clínica Dental Norte",
        slug: "clinica-norte",
        createdAt: new Date(),
        razonSocial: "Clínica Dental Norte CIA. LTDA.",
        ruc: "1790000001001",
        codigoEstablecimiento: "001",
        direccion: "Av. Amazonas N12-34",
        telefono: "02-2220000",
        canton: "Quito",
        provincia: "Pichincha",
        retenerAudio: false,
        inactividadMinutos: 5,
      },
      {
        id: clinicaB,
        name: "Clínica Dental Sur",
        slug: "clinica-sur",
        createdAt: new Date(),
        razonSocial: "Clínica Dental Sur CIA. LTDA.",
        ruc: "1790000002001",
        codigoEstablecimiento: "002",
        direccion: "Av. Maldonado S5-67",
        telefono: "02-2330000",
        canton: "Quito",
        provincia: "Pichincha",
        retenerAudio: false,
        inactividadMinutos: 5,
      },
    ])
    .onConflictDoNothing();

  const odontologoId = "user_odontologo";
  const auxiliarId = "user_auxiliar";
  const adminId = "user_admin";
  const multiId = "user_multi";

  await upsertUser({
    id: odontologoId,
    name: "Dra. Ana Odontóloga",
    email: "odontologo@demo.local",
    pinHash,
    passwordHash,
  });
  await upsertUser({
    id: auxiliarId,
    name: "Luis Auxiliar",
    email: "auxiliar@demo.local",
    pinHash,
    passwordHash,
  });
  await upsertUser({
    id: adminId,
    name: "María Admin",
    email: "admin@demo.local",
    pinHash,
    passwordHash,
  });
  await upsertUser({
    id: multiId,
    name: "Dr. Carlos Multi",
    email: "multi@demo.local",
    pinHash,
    passwordHash,
  });

  const memberships = [
    {
      id: "mem_odonto_a",
      organizationId: clinicaA,
      userId: odontologoId,
      role: "odontologo",
    },
    {
      id: "mem_aux_a",
      organizationId: clinicaA,
      userId: auxiliarId,
      role: "auxiliar",
    },
    {
      id: "mem_admin_a",
      organizationId: clinicaA,
      userId: adminId,
      role: "admin",
    },
    {
      id: "mem_multi_a",
      organizationId: clinicaA,
      userId: multiId,
      role: "odontologo",
    },
    {
      id: "mem_multi_b",
      organizationId: clinicaB,
      userId: multiId,
      role: "odontologo",
    },
  ] as const;

  for (const m of memberships) {
    await db
      .insert(member)
      .values({
        ...m,
        createdAt: new Date(),
        estado: "activa",
        firmaTipo: "dibujada",
        registroProfesionalClinica:
          m.role === "odontologo" ? "ACESS-DEMO-001" : null,
      })
      .onConflictDoNothing();
  }

  // FORCE RLS applies to migrator too — seed under explicit tenant context
  const { sql } = await import("drizzle-orm");

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.clinica_id', ${clinicaA}, true)`,
    );
    await tx
      .insert(pacientes)
      .values({
        id: "pac_a_1",
        clinicaId: clinicaA,
        tipoDocumento: "cedula",
        numeroDocumento: "1700000001",
        nombres: "Paciente",
        apellidos: "Norte Uno",
        fechaNacimiento: new Date("1990-01-15"),
        sexo: "femenino",
        numeroArchivo: "A-0001",
        createdBy: odontologoId,
      })
      .onConflictDoNothing();
  });

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.clinica_id', ${clinicaB}, true)`,
    );
    await tx
      .insert(pacientes)
      .values({
        id: "pac_b_1",
        clinicaId: clinicaB,
        tipoDocumento: "cedula",
        numeroDocumento: "1700000002",
        nombres: "Paciente",
        apellidos: "Sur Uno",
        fechaNacimiento: new Date("1985-06-20"),
        sexo: "masculino",
        numeroArchivo: "B-0001",
        createdBy: multiId,
      })
      .onConflictDoNothing();
  });

  console.log("Seed OK");
  console.log("Users (password Demo1234!, PIN 1234):");
  console.log("  odontologo@demo.local — odontologo @ Clínica Norte");
  console.log("  auxiliar@demo.local   — auxiliar @ Clínica Norte");
  console.log("  admin@demo.local      — admin @ Clínica Norte");
  console.log("  multi@demo.local      — odontologo @ Norte y Sur");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
