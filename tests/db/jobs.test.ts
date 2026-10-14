import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getAdminDb, getDb, schema, withTenant } from "@/db/client";
import { enqueue, registerJob, runDueJobs } from "@/server/jobs/queue";
import { dbError, makeFirm } from "./helpers";

afterAll(closeDb);

describe("job queue", () => {
  it("runs each job exactly once across concurrent workers", async () => {
    const runs = new Map<number, number>();
    const kind = `count-${crypto.randomUUID().slice(0, 6)}`;
    registerJob(kind, async (job) => {
      runs.set(job.id, (runs.get(job.id) ?? 0) + 1);
      await new Promise((r) => setTimeout(r, 5));
    });
    const db = getAdminDb();
    for (let i = 0; i < 20; i++) await enqueue(getDb(), { firmId: null, kind });
    await Promise.all([runDueJobs({ limit: 20, worker: "a" }), runDueJobs({ limit: 20, worker: "b" }), runDueJobs({ limit: 20, worker: "c" })]);
    const rows = await db.select().from(schema.job).where(eq(schema.job.kind, kind));
    expect(rows.length).toBe(20);
    expect(rows.every((r) => r.status === "done")).toBe(true);
    expect([...runs.values()].every((n) => n === 1)).toBe(true);
    expect(runs.size).toBe(20);
  });

  it("retries failures with backoff and gives up after max attempts", async () => {
    const kind = `fail-${crypto.randomUUID().slice(0, 6)}`;
    registerJob(kind, async () => {
      throw new Error("boom");
    });
    const db = getAdminDb();
    await enqueue(getDb(), { firmId: null, kind, maxAttempts: 2 });
    await runDueJobs({ limit: 50 });
    let [row] = await db.select().from(schema.job).where(eq(schema.job.kind, kind));
    expect(row.status).toBe("queued");
    expect(row.lastError).toBe("boom");
    expect(row.runAt.getTime()).toBeGreaterThan(Date.now());
    await db.update(schema.job).set({ runAt: new Date(Date.now() - 1000) }).where(inArray(schema.job.id, [row.id]));
    await runDueJobs({ limit: 50 });
    [row] = await db.select().from(schema.job).where(eq(schema.job.kind, kind));
    expect(row.status).toBe("dead");
    expect(row.attempts).toBe(2);
  });

  it("deduplicates by key", async () => {
    const key = `dedupe-${crypto.randomUUID()}`;
    const db = getAdminDb();
    await enqueue(getDb(), { firmId: null, kind: "noop", dedupeKey: key });
    await enqueue(getDb(), { firmId: null, kind: "noop", dedupeKey: key });
    const rows = await db.select().from(schema.job).where(eq(schema.job.dedupeKey, key));
    expect(rows.length).toBe(1);
  });

  it("firm jobs can only be queued from inside that firm's tenant context", async () => {
    const A = await makeFirm("jobs-a");
    const B = await makeFirm("jobs-b");
    const ctx = { firmId: A.firm.id, userId: A.staffUser, scope: "firm" as const };
    const kind = `tenant-${crypto.randomUUID().slice(0, 6)}`;
    await withTenant(ctx, (tx) => enqueue(tx, { firmId: A.firm.id, kind }));
    expect(await dbError(withTenant(ctx, (tx) => enqueue(tx, { firmId: B.firm.id, kind })))).toMatch(/not the current tenant/);
    expect(await dbError(enqueue(getDb(), { firmId: A.firm.id, kind }))).toMatch(/not the current tenant/);
    const rows = await getAdminDb().select().from(schema.job).where(eq(schema.job.kind, kind));
    expect(rows.map((r) => r.firmId)).toEqual([A.firm.id]);
  });
});
