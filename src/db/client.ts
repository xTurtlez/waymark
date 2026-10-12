import { sql as dsql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Database access.
 *
 * `db` is the privileged connection (used by auth, migrations, the job
 * runner and seeding). Request code must use `withTenant()`, which switches
 * to the `waymark_app` role so Postgres row-level security applies.
 */

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const g = globalThis as unknown as { __waymarkSql?: postgres.Sql; __waymarkDb?: Db };

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
  g.__waymarkSql = undefined;
  g.__waymarkDb = undefined;
}

export { schema };
