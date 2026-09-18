import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type AppDb = ReturnType<typeof drizzle<typeof schema>>;

let _appSql: ReturnType<typeof postgres> | undefined;
let _migratorSql: ReturnType<typeof postgres> | undefined;
let _dbUnsafe: AppDb | undefined;
let _dbMigrator: AppDb | undefined;

function getAppUrl(): string {
  const url = process.env.DATABASE_APP_URL;
  if (!url) throw new Error("DATABASE_APP_URL is required");
  return url;
}

function getMigratorUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}

/**
 * @internal Raw app_user client. Do NOT import from app routes or feature modules.
 * Use `withTenant` exclusively for clinical queries.
 */
export function getDbUnsafe(): AppDb {
  if (!_dbUnsafe) {
    _appSql = postgres(getAppUrl(), { max: 10 });
    _dbUnsafe = drizzle(_appSql, { schema });
  }
  return _dbUnsafe;
}

/** Migrator / seed / Better Auth adapter — not for clinical app feature code */
export function getDbMigrator(): AppDb {
  if (!_dbMigrator) {
    _migratorSql = postgres(getMigratorUrl(), { max: 5 });
    _dbMigrator = drizzle(_migratorSql, { schema });
  }
  return _dbMigrator;
}

/** @deprecated Prefer getDbUnsafe(); kept as named export for architecture lint detection */
export const dbUnsafe = new Proxy({} as AppDb, {
  get(_t, prop, receiver) {
    return Reflect.get(getDbUnsafe() as object, prop, receiver);
  },
});

export const dbMigrator = new Proxy({} as AppDb, {
  get(_t, prop, receiver) {
    return Reflect.get(getDbMigrator() as object, prop, receiver);
  },
});

export type Db = AppDb;
export type DbTransaction = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
