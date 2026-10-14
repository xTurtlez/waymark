import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getDb, schema, withTenant } from "@/db/client";
import { dbError, makeFirm } from "./helpers";

let A: Awaited<ReturnType<typeof makeFirm>>;
let B: Awaited<ReturnType<typeof makeFirm>>;

beforeAll(async () => {
  A = await makeFirm("rls-a");
  B = await makeFirm("rls-b");
});
afterAll(closeDb);

const staff = (f: typeof A) => ({ firmId: f.firm.id, userId: f.staffUser, scope: "firm" as const });
const family = (f: typeof A) => ({ firmId: f.firm.id, userId: f.familyUser, scope: "portal" as const });

describe("row-level security: firm scope", () => {
  it("staff see only their own firm's estates", async () => {
    const rows = await withTenant(staff(A), (tx) => tx.select().from(schema.estate));
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.firmId === A.firm.id)).toBe(true);
  });

  it("cross-firm reads return nothing, even by id", async () => {
    const rows = await withTenant(staff(A), (tx) => tx.select().from(schema.estate).where(eq(schema.estate.id, B.estates[0].id)));
    expect(rows).toEqual([]);
    const firms = await withTenant(staff(A), (tx) => tx.select().from(schema.firm));
    expect(firms.map((f) => f.id)).toEqual([A.firm.id]);
  });

  it("cross-firm updates change nothing", async () => {
    const updated = await withTenant(staff(A), (tx) =>
      tx.update(schema.estate).set({ deceasedFullName: "tampered" }).where(eq(schema.estate.id, B.estates[0].id)).returning(),
    );
    expect(updated).toEqual([]);
  });

  it("cross-firm inserts are rejected", async () => {
    expect(await dbError(withTenant(staff(A), (tx) => tx.insert(schema.estate).values({ firmId: B.firm.id, ref: "x", slug: "x", deceasedFullName: "x", workspace: {} })))).toMatch(/row-level security/);
  });

  it("raw SQL cannot escape the role or bypass policies", async () => {
    const count = await withTenant(staff(A), async (tx) => {
      const r = (await tx.execute(sql`select count(*)::int as n from estate`)) as unknown as Array<{ n: number }>;
      return r[0].n;
    });
    expect(count).toBe(2);
    expect(await dbError(withTenant(staff(A), (tx) => tx.execute(sql`set role postgres`)))).toMatch(/permission denied/);
  });

  it("no tenant context means no rows", async () => {
    const rows = await withTenant({ firmId: "00000000-0000-0000-0000-000000000000", userId: null, scope: "firm" }, (tx) => tx.select().from(schema.estate));
    expect(rows).toEqual([]);
  });
});

describe("row-level security: portal scope", () => {
  it("a family member sees only estates they are a party to", async () => {
    const rows = await withTenant(family(A), (tx) => tx.select().from(schema.estate));
    expect(rows.map((r) => r.id)).toEqual([A.estates[0].id]);
  });

  it("cannot read the audit trail or other estates' parties", async () => {
    const audit = await withTenant(family(A), (tx) => tx.select().from(schema.auditEvent));
    expect(audit).toEqual([]);
    const parties = await withTenant(family(A), (tx) => tx.select().from(schema.estateParty));
    expect(parties.every((p) => p.estateId === A.estates[0].id)).toBe(true);
  });

  it("cannot create estates", async () => {
    expect(
      await dbError(withTenant(family(A), (tx) => tx.insert(schema.estate).values({ firmId: A.firm.id, ref: "y", slug: "y", deceasedFullName: "y", workspace: {} }))),
    ).toMatch(/row-level security/);
  });

  it("a family member of firm A sees nothing of firm B even with B's firm id", async () => {
    const rows = await withTenant({ firmId: B.firm.id, userId: A.familyUser, scope: "portal" }, (tx) => tx.select().from(schema.estate));
    expect(rows).toEqual([]);
  });
});

describe("runtime login role", () => {
  // DATABASE_URL connects as waymark_runtime in CI (see ci.yml). Locally it may
  // be the owner; these checks are skipped then.
  const runtime = async () => {
    const r = (await getDb().execute(sql`select current_user as u`)) as unknown as Array<{ u: string }>;
    return r[0].u === "waymark_runtime";
  };

  it("cannot read tenant tables without withTenant()", async () => {
    if (!(await runtime())) return;
    for (const table of ["estate", "firm", "membership", "estate_party", "audit_event", "file_object"]) {
      expect(await dbError(getDb().execute(sql.raw(`select 1 from ${table} limit 1`)))).toMatch(/permission denied/);
    }
  });

  it("cannot become the owner or bypass RLS", async () => {
    if (!(await runtime())) return;
    expect(await dbError(getDb().execute(sql`set role postgres`))).toMatch(/permission denied/);
    const r = (await getDb().execute(sql`select rolbypassrls, rolsuper from pg_roles where rolname = current_user`)) as unknown as Array<{ rolbypassrls: boolean; rolsuper: boolean }>;
    expect(r[0]).toEqual({ rolbypassrls: false, rolsuper: false });
  });

  it("can only queue system jobs directly, not firm jobs", async () => {
    if (!(await runtime())) return;
    expect(await dbError(getDb().insert(schema.job).values({ firmId: A.firm.id, kind: "noop", payload: {} }))).toMatch(/row-level security/);
  });

  it("can resolve who a user is through app_viewer_context()", async () => {
    const r = (await getDb().execute(sql`select app_viewer_context(${A.familyUser}) as c`)) as unknown as Array<{ c: { memberships: unknown[]; parties: Array<{ estate_id: string }> } }>;
    expect(r[0].c.memberships).toEqual([]);
    expect(r[0].c.parties.map((p) => p.estate_id)).toEqual([A.estates[0].id]);
  });
});
