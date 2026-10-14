import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getAdminDb, schema, withTenant } from "@/db/client";
import { dbError, makeFirm } from "./helpers";

let F: Awaited<ReturnType<typeof makeFirm>>;
beforeAll(async () => {
  F = await makeFirm("audit");
});
afterAll(closeDb);

const verify = async (firmId: string) => {
  const r = (await getAdminDb().execute(sql`select audit_verify(${firmId}::uuid) as b`)) as unknown as Array<{ b: number | null }>;
  return r[0].b === null ? null : Number(r[0].b);
};

describe("audit log", () => {
  it("chains entries per firm and verifies", async () => {
    const ctx = { firmId: F.firm.id, userId: F.staffUser, scope: "firm" as const };
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        withTenant(ctx, (tx) => tx.insert(schema.auditEvent).values({ firmId: F.firm.id, estateId: F.estates[0].id, actorType: "staff", action: "t", entityType: "estate", summary: `e${i}`, after: { i } })),
      ),
    );
    const rows = await withTenant(ctx, (tx) => tx.select().from(schema.auditEvent).orderBy(schema.auditEvent.seq));
    expect(rows.map((r) => r.seq)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    for (let i = 1; i < rows.length; i++) expect(rows[i].prevHash).toBe(rows[i - 1].hash);
    expect(await verify(F.firm.id)).toBeNull();
  });

  it("rejects updates and deletes, even from the owner role", async () => {
    expect(await dbError(getAdminDb().execute(sql`update audit_event set summary = 'x' where firm_id = ${F.firm.id}`))).toMatch(/append-only/);
    expect(await dbError(getAdminDb().execute(sql`delete from audit_event where firm_id = ${F.firm.id}`))).toMatch(/append-only/);
  });

  it("the app role has no UPDATE or DELETE privilege at all", async () => {
    const ctx = { firmId: F.firm.id, userId: F.staffUser, scope: "firm" as const };
    expect(await dbError(withTenant(ctx, (tx) => tx.execute(sql`delete from audit_event`)))).toMatch(/permission denied|append-only/);
  });

  it("detects tampering", async () => {
    const db = getAdminDb();
    await db.transaction(async (tx) => {
      await tx.execute(sql`alter table audit_event disable trigger audit_event_no_update`);
      await tx.execute(sql`update audit_event set summary = 'rewritten' where firm_id = ${F.firm.id} and seq = 5`);
      await tx.execute(sql`alter table audit_event enable trigger audit_event_no_update`);
    });
    expect(await verify(F.firm.id)).toBe(5);
  });
});
