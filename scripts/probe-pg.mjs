import postgres from "postgres";

const url =
  process.env.POSTGRES_SUPERUSER_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";

const sql = postgres(url, { max: 1, connect_timeout: 3 });

try {
  const r = await sql`select current_user as u, version() as v`;
  console.log("CONNECTED", r[0]?.u);
  await sql.end();
  process.exit(0);
} catch (e) {
  console.error("FAIL", e instanceof Error ? e.message : e);
  try {
    await sql.end({ timeout: 1 });
  } catch {
    /* ignore */
  }
  process.exit(1);
}
