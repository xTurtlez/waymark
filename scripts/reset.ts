import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";

/** Drop everything in the public schema (dev/CI only) and re-run migrations. */
async function main() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DB_RESET) throw new Error("Refusing to reset a production database.");
  const db = getDb();
  await db.execute(sql`drop schema if exists public cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await db.execute(sql`create schema public`);
  await db.execute(sql`grant all on schema public to public`);
  console.log("Schema dropped.");
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
