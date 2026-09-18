/**
 * Bootstrap roles/db on a fresh Postgres (Windows install or Docker init already done).
 * Usage:
 *   set POSTGRES_SUPERUSER_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/postgres
 *   node scripts/bootstrap-db.mjs
 */
import "dotenv/config";
import postgres from "postgres";

const superUrl =
  process.env.POSTGRES_SUPERUSER_URL ??
  process.env.DATABASE_URL?.replace(/\/clinica$/, "/postgres");

if (!superUrl) {
  console.error("Set POSTGRES_SUPERUSER_URL (e.g. postgresql://postgres:pass@localhost:5432/postgres)");
  process.exit(1);
}

const appPassword = process.env.POSTGRES_APP_PASSWORD ?? "app_user_dev_only";
const migratorPassword =
  process.env.POSTGRES_MIGRATOR_PASSWORD ?? "migrator_dev_only";

const sql = postgres(superUrl, { max: 1 });

async function main() {
  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'migrator') THEN
        CREATE ROLE migrator LOGIN PASSWORD '${migratorPassword}' CREATEDB;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user LOGIN PASSWORD '${appPassword}';
      END IF;
    END
    $$;
  `);

  const dbs = await sql`SELECT 1 FROM pg_database WHERE datname = 'clinica'`;
  if (dbs.length === 0) {
    await sql.unsafe(`CREATE DATABASE clinica OWNER migrator`);
  }

  await sql.unsafe(`GRANT CONNECT ON DATABASE clinica TO app_user`);
  await sql.end();

  const clinica = postgres(
    superUrl.replace(/\/[^/]+$/, "/clinica").replace(/:[^:@]+@/, `:${migratorPassword}@`).includes("migrator")
      ? `postgresql://migrator:${migratorPassword}@localhost:5432/clinica`
      : `postgresql://migrator:${migratorPassword}@localhost:5432/clinica`,
    { max: 1 },
  );

  // Reconnect as superuser to clinica for grants
  const asSuper = postgres(superUrl.replace(/\/[^/]+$/, "/clinica"), { max: 1 });
  await asSuper.unsafe(`
    GRANT ALL ON SCHEMA public TO migrator;
    GRANT USAGE ON SCHEMA public TO app_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
    ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO app_user;
  `);
  await asSuper.end();
  await clinica.end().catch(() => undefined);

  console.log("Bootstrap OK: database clinica, roles migrator + app_user");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
