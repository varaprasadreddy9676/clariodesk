import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;

let sql: ReturnType<typeof postgres> | undefined;
let db: Database | undefined;

/**
 * Lazily creates a singleton Drizzle client. Every runtime process shares one
 * connection pool. Call {@link closeDb} on shutdown.
 */
export function getDb(databaseUrl: string): Database {
  if (db) return db;
  sql = postgres(databaseUrl, { max: 10 });
  db = drizzle(sql, { schema });
  return db;
}

export async function closeDb(): Promise<void> {
  await sql?.end({ timeout: 5 });
  sql = undefined;
  db = undefined;
}
