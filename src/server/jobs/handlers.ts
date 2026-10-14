import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { enqueue, registerJob } from "./queue";

/**
 * Job handlers. M1 ships the nightly audit-chain check; the Transaction
 * Engine (M4) adds chasers, SLA timers, extraction and notifications.
 */

/** Recompute every firm's audit hash chain; schedule tomorrow's run. */
registerJob("audit.verify", async () => {
  const db = getDb();
  const rows = (await db.execute(sql`select firm_name, first_broken from audit_verify_all()`)) as unknown as Array<{ firm_name: string; first_broken: number }>;
  const broken = rows.map((r) => `${r.firm_name} (seq ${r.first_broken})`);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(2, 0, 0, 0);
  await enqueue(db, { firmId: null, kind: "audit.verify", runAt: tomorrow, dedupeKey: `audit.verify:${tomorrow.toISOString().slice(0, 10)}` });
  if (broken.length) throw new Error(`Audit chain broken for: ${broken.join(", ")}`);
});

registerJob("noop", async () => {});
