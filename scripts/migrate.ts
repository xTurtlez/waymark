import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getAdminDb } from "../src/db/client";

async function main() {
  await migrate(getAdminDb(), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
