import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL required");
  const sql = postgres(url, { max: 1 });
  const file = resolve(process.cwd(), "drizzle/rls.sql");
  const body = readFileSync(file, "utf8");
  await sql.unsafe(body);
  await sql.end();
  console.log("RLS policies applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
