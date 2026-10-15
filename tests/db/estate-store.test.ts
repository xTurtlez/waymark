import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getAdminDb, schema, withTenant } from "@/db/client";
import { buildSeed } from "@/lib/seed";
import type { Estate, StaffMember } from "@/lib/types";
import { loadEstates, saveEstate } from "@/server/estate-store";
import { dbError } from "./helpers";

/**
 * The normalised estate tables: a full estate survives save → load unchanged,
 * and families see and change only what they should.
 */

const NOW = new Date("2026-10-14T09:00:00Z");
let firmId: string;
let estateUuid: string;
let staffUser: string;
let familyUser: string;
let staff: StaffMember[];
let original: Estate;

/** Drop what the store intentionally doesn't round-trip (the trail comes from audit_event). */
const comparable = (e: Estate) => ({ ...e, audit: [], tasks: [...e.tasks].sort((a, b) => (a.id < b.id ? -1 : 1)) });

beforeAll(async () => {
  const db = getAdminDb();
  const tag = crypto.randomUUID().slice(0, 8);
  const [firm] = await db.insert(schema.firm).values({ slug: `store-${tag}`, name: "Store Test LLP", shortName: "Store" }).returning();
  firmId = firm.id;
  staffUser = crypto.randomUUID();
  familyUser = crypto.randomUUID();
  await db.insert(schema.user).values([
    { id: staffUser, name: "Priya Shah", email: `priya-${tag}@test.example` },
    { id: familyUser, name: "Sarah Ellis", email: `sarah-${tag}@test.example` },
  ]);
  const [m] = await db.insert(schema.membership).values({ firmId, userId: staffUser, role: "partner", title: "Partner", initials: "PS", color: "#E36E55" }).returning();
  staff = [{ id: m.id, name: "Priya Shah", initials: "PS", role: "Partner", color: "#E36E55" }];

  // The demo estate, with every staff reference pointed at the real membership and no second staff member.
  const seed = buildSeed(NOW);
  const ellis = JSON.parse(JSON.stringify(seed.estates.find((e) => e.id === "ellis")!).replace(/"s_(ps|jt)"/g, `"${m.id}"`)) as Estate;
  ellis.parties = ellis.parties.filter((p) => p.id !== "p_james");
  original = ellis;

  estateUuid = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.estate).values({ id: estateUuid, firmId, ref: ellis.ref, slug: ellis.id, deceasedFullName: ellis.deceased.fullName, deceasedFirstName: "Margaret", deceasedShortName: "Margaret Ellis", feeEarnerId: m.id, openedAt: new Date(ellis.openedAt) });
    await saveEstate(tx, { firmId, estateUuid, actorMembershipId: m.id, actorUserId: staffUser, scope: "firm" }, null, ellis);
    await tx.update(schema.estateParty).set({ userId: familyUser, acceptedAt: NOW }).where(and(eq(schema.estateParty.estateId, estateUuid), eq(schema.estateParty.key, "p_sarah")));
  });
});
afterAll(closeDb);

const firmCtx = () => ({ firmId, userId: staffUser, scope: "firm" as const });
const familyCtx = () => ({ firmId, userId: familyUser, scope: "portal" as const });
const load = (scope: "firm" | "portal") =>
  withTenant(scope === "firm" ? firmCtx() : familyCtx(), (tx) => loadEstates(tx, { staff, staffByUser: new Map([[staffUser, staff[0].id]]), scope, now: NOW }));

describe("estate store", () => {
  it("round-trips a full estate through the normalised tables", async () => {
    const { estates } = await load("firm");
    const loaded = estates[0];
    // Sarah has accepted her invite in the database; the seed says "active" too.
    expect(comparable(loaded)).toEqual(comparable(original));
  });

  it("saves only what changed, and the change reads back", async () => {
    const { estates } = await load("firm");
    const before = estates[0];
    const after = structuredClone(before);
    after.tasks.find((t) => t.id === "t_barclays")!.done = true;
    after.tasks.find((t) => t.id === "t_barclays")!.doneAt = NOW.toISOString();
    after.notes.unshift({ id: "n_new", text: "Called Barclays", author: staff[0].id, at: NOW.toISOString() });
    await withTenant(firmCtx(), (tx) => saveEstate(tx, { firmId, estateUuid, actorMembershipId: staff[0].id, actorUserId: staffUser, scope: "firm" }, before, after));
    const reread = (await load("firm")).estates[0];
    expect(reread.tasks.find((t) => t.id === "t_barclays")).toMatchObject({ done: true, doneAt: NOW.toISOString() });
    expect(reread.notes[0]).toMatchObject({ id: "n_new", text: "Called Barclays" });
    expect(reread.waitingOn).toBe("family");
  });

  it("gives a family member their estate without the firm's working papers", async () => {
    const { estates } = await load("portal");
    expect(estates).toHaveLength(1);
    const e = estates[0];
    expect(e.notes).toEqual([]);
    expect(e.drafts).toEqual([]);
    expect(e.extractions).toEqual([]);
    expect(e.missing).toEqual([]);
    expect(e.will).toBeUndefined();
    expect(e.tasks.every((t) => t.owner.kind === "family")).toBe(true);
    expect(e.assets.length).toBe(original.assets.length);
    expect(e.messages.length).toBe(original.messages.length);
    expect(e.updates.length).toBe(original.updates.length);
  });

  it("lets a family member ask the firm to check an upload, but not touch firm tasks or notes", async () => {
    await withTenant(familyCtx(), (tx) =>
      tx.insert(schema.task).values({ firmId, estateId: estateUuid, key: "t_check_upload", title: "Check upload", ownerKind: "firm", ownerMembershipId: staff[0].id }),
    );
    expect(
      await dbError(withTenant(familyCtx(), (tx) => tx.insert(schema.note).values({ firmId, estateId: estateUuid, key: "n_x", body: "sneaky" }))),
    ).toMatch(/row-level security/);
    const changed = await withTenant(familyCtx(), (tx) =>
      tx.update(schema.task).set({ title: "tampered" }).where(and(eq(schema.task.estateId, estateUuid), eq(schema.task.key, "t_aviva"))).returning(),
    );
    expect(changed).toEqual([]);
    expect(await dbError(withTenant(familyCtx(), (tx) => tx.insert(schema.clientUpdate).values({ firmId, estateId: estateUuid, key: "u_x", title: "x", body: "x" })))).toMatch(/row-level security/);
  });

  it("never lets the app delete estate records", async () => {
    expect(await dbError(withTenant(firmCtx(), (tx) => tx.delete(schema.task).where(eq(schema.task.estateId, estateUuid))))).toMatch(/permission denied/);
    expect(await dbError(withTenant(firmCtx(), (tx) => tx.delete(schema.holding).where(eq(schema.holding.estateId, estateUuid))))).toMatch(/permission denied/);
  });

  it("serves the institution directory read-only", async () => {
    await getAdminDb().insert(schema.institution).values({ name: `Test Bank ${crypto.randomUUID().slice(0, 6)}`, kind: "bank" });
    const rows = await withTenant(firmCtx(), (tx) => tx.select().from(schema.institution));
    expect(rows.length).toBeGreaterThan(0);
    expect(await dbError(withTenant(firmCtx(), (tx) => tx.insert(schema.institution).values({ name: "Mine", kind: "bank" })))).toMatch(/permission denied/);
  });
});

describe("inheritance tax records", () => {
  const ihtTables = () => [schema.ihtProfile, schema.lifetimeGift, schema.priorTransfer, schema.holdingTax, schema.partyTax];

  it("round-trip with the estate for the firm", async () => {
    const e = (await load("firm")).estates[0];
    expect(e.tax).toEqual(original.tax);
    expect(e.assets.find((a) => a.id === "a_house")?.tax).toEqual({ qualifyingResidence: true });
    expect(e.will?.gifts.find((g) => g.assetId)?.assetId).toBe("a_house");
  });

  it("save solicitor changes to a holding, a person and the gifts", async () => {
    const before = (await load("firm")).estates[0];
    const after = structuredClone(before);
    after.assets.find((a) => a.id === "a_house")!.tax = { qualifyingResidence: true, ownership: "tenancy_in_common", relief: { kind: "agricultural", rate: "half" } };
    after.parties.find((p) => p.id === "p_sarah")!.taxCategory = "other";
    after.tax!.gifts.push({ id: "lg_test", madeOn: "2024-03-01", valuePence: 5_000_00, description: "Cash", recipientPartyId: "p_sarah", recipientCategory: "other", form: "outright" });
    await withTenant(firmCtx(), (tx) => saveEstate(tx, { firmId, estateUuid, actorMembershipId: staff[0].id, actorUserId: staffUser, scope: "firm" }, before, after));
    const mid = (await load("firm")).estates[0];
    expect(mid.assets.find((a) => a.id === "a_house")?.tax).toEqual(after.assets.find((a) => a.id === "a_house")!.tax);
    expect(mid.parties.find((p) => p.id === "p_sarah")?.taxCategory).toBe("other");
    expect(mid.tax!.gifts.find((g) => g.id === "lg_test")).toMatchObject({ valuePence: 5_000_00, recipientPartyId: "p_sarah" });

    // Withdrawn, not deleted; and clearing a category goes back to "from relationship".
    const later = structuredClone(mid);
    later.tax!.gifts.find((g) => g.id === "lg_test")!.voided = true;
    later.parties.find((p) => p.id === "p_sarah")!.taxCategory = undefined;
    await withTenant(firmCtx(), (tx) => saveEstate(tx, { firmId, estateUuid, actorMembershipId: staff[0].id, actorUserId: staffUser, scope: "firm" }, mid, later));
    const end = (await load("firm")).estates[0];
    expect(end.tax!.gifts.find((g) => g.id === "lg_test")?.voided).toBe(true);
    expect(end.parties.find((p) => p.id === "p_sarah")?.taxCategory).toBeUndefined();
    expect(await dbError(withTenant(firmCtx(), (tx) => tx.delete(schema.lifetimeGift).where(eq(schema.lifetimeGift.estateId, estateUuid))))).toMatch(/permission denied/);
  });

  it("are never visible to a family member", async () => {
    const e = (await load("portal")).estates[0];
    expect(e.tax).toBeUndefined();
    expect(e.assets.every((a) => a.tax === undefined)).toBe(true);
    expect(e.parties.every((p) => p.taxCategory === undefined)).toBe(true);
    for (const t of ihtTables()) {
      expect(await withTenant(familyCtx(), (tx) => tx.select().from(t).where(eq(t.estateId, estateUuid)))).toEqual([]);
    }
    // The rows exist; the family just can't see them.
    const [{ n }] = (await getAdminDb().execute(sql`select count(*)::int as n from holding_tax where estate_id = ${estateUuid}`)) as unknown as Array<{ n: number }>;
    expect(n).toBeGreaterThan(0);
    expect(
      await dbError(withTenant(familyCtx(), (tx) => tx.insert(schema.ihtProfile).values({ firmId, estateId: crypto.randomUUID() }))),
    ).toMatch(/row-level security|foreign key/);
    const changed = await withTenant(familyCtx(), (tx) => tx.update(schema.ihtProfile).set({ transferredNrbBp: 0 }).where(eq(schema.ihtProfile.estateId, estateUuid)).returning());
    expect(changed).toEqual([]);
  });

  it("survive a family member editing the holding", async () => {
    const before = (await load("portal")).estates[0];
    const after = structuredClone(before);
    const house = after.assets.find((a) => a.id === "a_house")!;
    house.valuePence = (house.valuePence ?? 0) + 1_000_00;
    await withTenant(familyCtx(), (tx) => saveEstate(tx, { firmId, estateUuid, actorMembershipId: null, actorUserId: familyUser, scope: "portal" }, before, after));
    const firmView = (await load("firm")).estates[0].assets.find((a) => a.id === "a_house")!;
    expect(firmView.valuePence).toBe(house.valuePence);
    expect(firmView.tax?.qualifyingResidence).toBe(true);
  });
});

describe("schema guard", () => {
  it("has row-level security on every table that carries firm_id", async () => {
    const rows = (await getAdminDb().execute(sql`
      select c.relname as t, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and exists (select 1 from information_schema.columns col where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'firm_id')`)) as unknown as Array<{ t: string; rls: boolean }>;
    expect(rows.length).toBeGreaterThan(15);
    expect(rows.filter((r) => !r.rls).map((r) => r.t)).toEqual([]);
  });
});
