import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const maxAttempts = 30;
const sql = postgres(url, { max: 1 });

for (let i = 1; i <= maxAttempts; i++) {
  try {
    await sql`select 1`;
    console.log("Postgres ready");
    await sql.end();
    process.exit(0);
  } catch {
    console.log(`Waiting for Postgres (${i}/${maxAttempts})…`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

console.error("Postgres did not become ready");
process.exit(1);
