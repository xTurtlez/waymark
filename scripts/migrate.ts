import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "../src/db/client";

async function main() {
  await migrate(getDb(), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
