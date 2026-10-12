import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { enqueue, registerJob } from "./queue";

/**
 * Job handlers. M1 ships the nightly audit-chain check; the Transaction
 * Engine (M4) adds chasers, SLA timers, extraction and notifications.
 */

/** Recompute every firm's audit hash chain; schedule tomorrow's run. */
registerJob("audit.verify", async () => {
  const db = getDb();
  const firms = await db.select({ id: schema.firm.id, name: schema.firm.name }).from(schema.firm);
  const broken: string[] = [];
  for (const f of firms) {
    const [row] = (await db.execute(sql`select audit_verify(${f.id}::uuid) as first_broken`)) as unknown as Array<{ first_broken: number | null }>;
    if (row?.first_broken != null) broken.push(`${f.name} (seq ${row.first_broken})`);
  }
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(2, 0, 0, 0);
  await enqueue(db, { firmId: null, kind: "audit.verify", runAt: tomorrow, dedupeKey: `audit.verify:${tomorrow.toISOString().slice(0, 10)}` });
  if (broken.length) throw new Error(`Audit chain broken for: ${broken.join(", ")}`);
});

registerJob("noop", async () => {});
