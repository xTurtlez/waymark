import "server-only";
import { schema, type Tx } from "@/db/client";

export interface AuditInput {
  firmId: string;
  estateId?: string | null;
  actorType: "staff" | "family" | "system" | "ai" | "support";
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  ai?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/** Append to the hash-chained audit log (seq and hashes are set by the database). */
export async function writeAudit(tx: Tx, e: AuditInput) {
  await tx.insert(schema.auditEvent).values({
    firmId: e.firmId,
    estateId: e.estateId ?? null,
    actorType: e.actorType,
    actorUserId: e.actorUserId ?? null,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId ?? null,
    summary: e.summary,
    before: (e.before ?? null) as object | null,
    after: (e.after ?? null) as object | null,
    ai: (e.ai ?? null) as object | null,
    ip: e.ip ?? null,
    userAgent: e.userAgent ?? null,
  });
}

type Rec = Record<string, unknown>;
const hasId = (v: unknown): v is { id: string } => typeof v === "object" && v !== null && typeof (v as Rec).id === "string";

/**
 * Compact before/after for an estate change: for arrays of records with ids,
 * only the items added, removed or changed; other keys when they differ.
 */
export function diffEstate(before: Rec, after: Rec): { before: Rec; after: Rec } {
  const b: Rec = {};
  const a: Rec = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const x = before[key];
    const y = after[key];
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (Array.isArray(x) && Array.isArray(y) && [...x, ...y].every(hasId)) {
      const xm = new Map(x.map((i) => [i.id, i]));
      const ym = new Map(y.map((i) => [i.id, i]));
      const bx = x.filter((i) => JSON.stringify(i) !== JSON.stringify(ym.get(i.id)));
      const ay = y.filter((i) => JSON.stringify(i) !== JSON.stringify(xm.get(i.id)));
      if (bx.length) b[key] = bx;
      if (ay.length) a[key] = ay;
    } else {
      b[key] = x;
      a[key] = y;
    }
  }
  return { before: b, after: a };
}
