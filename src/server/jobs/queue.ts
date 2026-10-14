import { sql } from "drizzle-orm";
import { getDb, type Db, type Tx } from "@/db/client";

/**
 * Durable job queue on Postgres. `enqueue()` can run inside a tenant
 * transaction (so the job commits with the change that caused it);
 * `runDueJobs()` claims work with FOR UPDATE SKIP LOCKED, so two workers never
 * take the same job. Failures retry with exponential backoff.
 */
export interface JobRecord {
  id: number;
  firmId: string | null;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export type JobHandler = (job: JobRecord) => Promise<void>;
const handlers = new Map<string, JobHandler>();

export function registerJob(kind: string, handler: JobHandler) {
  handlers.set(kind, handler);
}

export async function enqueue(
  db: Db | Tx,
  job: { firmId: string | null; kind: string; payload?: Record<string, unknown>; runAt?: Date; dedupeKey?: string; maxAttempts?: number },
) {
  // Goes through job_enqueue() (SECURITY DEFINER): it checks the firm matches
  // the tenant context and de-duplicates on dedupe_key.
  await db.execute(
    sql`select job_enqueue(${job.firmId}::uuid, ${job.kind}, ${JSON.stringify(job.payload ?? {})}::jsonb, ${(job.runAt ?? new Date()).toISOString()}::timestamptz, ${job.dedupeKey ?? null}, ${job.maxAttempts ?? 5})`,
  );
}

/** Backoff: 30s, 2m, 8m, 32m, ... capped at 6h. */
export function backoffMs(attempt: number): number {
  return Math.min(30_000 * 4 ** Math.max(0, attempt - 1), 6 * 60 * 60 * 1000);
}

export async function runDueJobs(opts: { limit?: number; worker?: string } = {}) {
  const db = getDb();
  const worker = opts.worker ?? `w-${process.pid}-${crypto.randomUUID().slice(0, 8)}`;
  const claimed = (await db.execute(sql`select * from job_claim(${worker}, ${opts.limit ?? 10})`)) as unknown as Array<{
    id: number | string;
    firm_id: string | null;
    kind: string;
    payload: Record<string, unknown>;
    attempts: number;
    max_attempts: number;
  }>;
  const results: { id: number; kind: string; ok: boolean; error?: string }[] = [];
  for (const r of claimed) {
    const job: JobRecord = { id: Number(r.id), firmId: r.firm_id, kind: r.kind, payload: r.payload, attempts: r.attempts, maxAttempts: r.max_attempts };
    const handler = handlers.get(job.kind);
    try {
      if (!handler) throw new Error(`No handler registered for "${job.kind}"`);
      await handler(job);
      await db.execute(sql`select job_finish(${job.id}::bigint, 'done'::job_status, null, null)`);
      results.push({ id: job.id, kind: job.kind, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const dead = job.attempts >= job.maxAttempts;
      const runAt = new Date(Date.now() + backoffMs(job.attempts)).toISOString();
      await db.execute(sql`select job_finish(${job.id}::bigint, ${dead ? "dead" : "queued"}::job_status, ${msg.slice(0, 2000)}, ${runAt}::timestamptz)`);
      results.push({ id: job.id, kind: job.kind, ok: false, error: msg });
    }
  }
  return results;
}
