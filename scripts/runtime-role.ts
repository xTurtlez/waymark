import { sql } from "drizzle-orm";
import { closeDb, getAdminDb } from "../src/db/client";

/**
 * Give the `waymark_runtime` role (created by the migrations) a login password.
 * Run once per database with the admin URL, then point the app's DATABASE_URL at
 *   postgres://waymark_runtime:<password>@<host>/<db>
 * Usage: RUNTIME_DB_PASSWORD=... npm run db:runtime-role
 */
async function main() {
  const pw = process.env.RUNTIME_DB_PASSWORD;
  if (!pw || pw.length < 16) throw new Error("Set RUNTIME_DB_PASSWORD (16+ characters).");
  const literal = `'${pw.replace(/'/g, "''")}'`;
  await getAdminDb().execute(sql.raw(`ALTER ROLE waymark_runtime WITH LOGIN PASSWORD ${literal}`));
  console.log("waymark_runtime can now log in.");
  await closeDb();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await closeDb();
  process.exit(1);
});
