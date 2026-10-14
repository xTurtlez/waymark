import { sql as dsql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database access.
 *
 * Two connections:
 * - `getDb()` connects as DATABASE_URL, which in every deployed environment is
 *   the `waymark_runtime` login: not a table owner, no BYPASSRLS. It can use the
 *   auth tables and a few SECURITY DEFINER functions directly; everything else
 *   goes through `withTenant()`, which switches to `waymark_app` so row-level
 *   security applies.
 * - `getAdminDb()` connects as DATABASE_ADMIN_URL (the owner). Only migrations,
 *   seeding, admin scripts and test fixtures use it. Never request code.
 */

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const g = globalThis as unknown as { __waymarkSql?: postgres.Sql; __waymarkDb?: Db; __waymarkAdminSql?: postgres.Sql; __waymarkAdminDb?: Db };

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  return url;
}

export function getSql(): postgres.Sql {
  if (!g.__waymarkSql) {
    // prepare:false keeps us compatible with transaction-mode poolers (Neon, Supabase).
    g.__waymarkSql = postgres(databaseUrl(), { max: Number(process.env.DATABASE_POOL_MAX ?? 5), prepare: false, onnotice: () => {} });
  }
  return g.__waymarkSql;
}

export function getDb(): Db {
  if (!g.__waymarkDb) g.__waymarkDb = drizzle(getSql(), { schema });
  return g.__waymarkDb;
}

/** Owner connection for migrations, seed, admin scripts and test fixtures. Falls back to DATABASE_URL. */
export function adminDatabaseUrl(): string {
  return process.env.DATABASE_ADMIN_URL || databaseUrl();
}

export function getAdminDb(): Db {
  if (!g.__waymarkAdminDb) {
    g.__waymarkAdminSql = postgres(adminDatabaseUrl(), { max: 3, prepare: false, onnotice: () => {} });
    g.__waymarkAdminDb = drizzle(g.__waymarkAdminSql, { schema });
  }
  return g.__waymarkAdminDb;
}

export type TenantScope = "firm" | "portal";
export interface TenantContext {
  firmId: string;
  userId: string | null;
  scope: TenantScope;
}

/**
 * Run `fn` in a transaction where RLS applies for the given firm/user/scope.
 * Everything inside sees only rows the policies allow.
 */
export async function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      dsql`select set_config('app.firm_id', ${ctx.firmId}, true), set_config('app.user_id', ${ctx.userId ?? ""}, true), set_config('app.scope', ${ctx.scope}, true)`,
    );
    await tx.execute(dsql`set local role waymark_app`);
    return fn(tx);
  });
}

export async function closeDb() {
  if (g.__waymarkSql) await g.__waymarkSql.end({ timeout: 5 });
  if (g.__waymarkAdminSql) await g.__waymarkAdminSql.end({ timeout: 5 });
  g.__waymarkSql = undefined;
  g.__waymarkDb = undefined;
  g.__waymarkAdminSql = undefined;
  g.__waymarkAdminDb = undefined;
}

export { schema };
