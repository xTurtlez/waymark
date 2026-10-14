import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { closeDb, getAdminDb, schema } from "../src/db/client";
import { freshSeed } from "../src/lib/seed";
import type { Estate } from "../src/lib/types";
import { enqueue } from "../src/server/jobs/queue";

/**
 * Seed the demo firms.
 * - Ellis & Rowe: the v1 demo data (Margaret Ellis and eight other estates).
 * - Hartley Moss: a small second firm, used to prove tenant isolation.
 *
 * Staff sign in with email + SEED_STAFF_PASSWORD; families with a magic link.
 * Idempotent: firms that already exist are left alone.
 */

type Db = ReturnType<typeof getAdminDb>;
const PASSWORD = process.env.SEED_STAFF_PASSWORD || "waymark-demo-password";

export const SEED_USERS = {
  priya: "priya.shah@ellis-rowe.example",
  james: "james.tan@ellis-rowe.example",
  laura: "laura.mills@ellis-rowe.example",
  sarah: "sarah.ellis@example.com",
  owen: "owen.price@hartley-moss.example",
  ruth: "ruth.kemp@example.com",
};

async function createUser(db: Db, email: string, name: string, password?: string): Promise<string> {
  const [existing] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.insert(schema.user).values({ id, name, email, emailVerified: true });
  if (password) {
    await db.insert(schema.account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(password),
      updatedAt: new Date(),
    });
  }
  return id;
}

/** Replace v1 staff keys (e.g. "s_ps") with membership ids throughout an estate record. */
function remapStaff<T>(value: T, map: Record<string, string>): T {
  return JSON.parse(JSON.stringify(value), (_k, v) => (typeof v === "string" && map[v] ? map[v] : v)) as T;
}

async function seedEllisRowe(db: Db) {
  const seed = freshSeed();
  const [exists] = await db.select().from(schema.firm).where(eq(schema.firm.slug, "ellis-rowe"));
  if (exists) {
    console.log("Ellis & Rowe already seeded.");
    return;
  }
  const [firm] = await db
    .insert(schema.firm)
    .values({ slug: "ellis-rowe", name: seed.firm.name, shortName: seed.firm.shortName, town: seed.firm.town, sraNumber: "000000 (demo)" })
    .returning();

  const staffDefs = [
    { key: "s_ps", email: SEED_USERS.priya, role: "partner" as const },
    { key: "s_jt", email: SEED_USERS.james, role: "paralegal" as const },
    { key: "s_lm", email: SEED_USERS.laura, role: "fee_earner" as const },
  ];
  const keyToMembership: Record<string, string> = {};
  for (const def of staffDefs) {
    const s = seed.staff.find((x) => x.id === def.key)!;
    const userId = await createUser(db, def.email, s.name, PASSWORD);
    const [m] = await db
      .insert(schema.membership)
      .values({ firmId: firm.id, userId, role: def.role, title: s.role, initials: s.initials, color: s.color })
      .returning();
    keyToMembership[def.key] = m.id;
  }

  const sarahId = await createUser(db, SEED_USERS.sarah, "Sarah Ellis");
  let day = 0;
  for (const raw of seed.estates) {
    const e = remapStaff<Estate>(raw, keyToMembership);
    const opened = new Date(Date.now() - e.daysOpen * 86_400_000 + day++ * 1000);
    const [row] = await db
      .insert(schema.estate)
      .values({
        firmId: firm.id,
        ref: e.ref,
        slug: e.id,
        deceasedFullName: e.deceased.fullName,
        dateOfDeath: e.deceased.dateOfDeath || null,
        feeEarnerId: keyToMembership[raw.feeEarnerId] ?? null,
        workspace: e,
        openedAt: opened,
      })
      .returning();
    for (const p of e.parties.filter((x) => x.role === "executor" || x.role === "beneficiary")) {
      const isSarah = p.id === "p_sarah";
      await db.insert(schema.estateParty).values({
        firmId: firm.id,
        estateId: row.id,
        userId: isSarah ? sarahId : null,
        role: p.role === "executor" ? "executor" : "beneficiary",
        fullName: p.name,
        email: isSarah ? SEED_USERS.sarah : (p.email ?? null),
        relationship: p.relationship ?? null,
        workspaceKey: p.id,
        invitedAt: isSarah ? new Date("2026-06-01T10:00:00Z") : null,
        acceptedAt: isSarah ? new Date("2026-06-01T19:12:00Z") : null,
      });
    }
    await db.insert(schema.auditEvent).values({
      firmId: firm.id,
      estateId: row.id,
      actorType: "system",
      action: "seed.import",
      entityType: "estate",
      entityId: row.id,
      summary: `Imported ${e.deceased.fullName} (${e.ref}) from the v1 demo data`,
      after: { ref: e.ref, stage: e.stage },
    });
  }
  console.log(`Seeded Ellis & Rowe: ${seed.estates.length} estates, ${staffDefs.length} staff, 1 family user.`);
}

async function seedHartleyMoss(db: Db) {
  const [exists] = await db.select().from(schema.firm).where(eq(schema.firm.slug, "hartley-moss"));
  if (exists) {
    console.log("Hartley Moss already seeded.");
    return;
  }
  const [firm] = await db.insert(schema.firm).values({ slug: "hartley-moss", name: "Hartley Moss LLP", shortName: "Hartley Moss", town: "Leeds", sraNumber: "000001 (demo)" }).returning();
  const owenId = await createUser(db, SEED_USERS.owen, "Owen Price", PASSWORD);
  const [m] = await db.insert(schema.membership).values({ firmId: firm.id, userId: owenId, role: "firm_admin", title: "Partner", initials: "OP", color: "#5B2E57" }).returning();
  const ruthId = await createUser(db, SEED_USERS.ruth, "Ruth Kemp");

  const base = freshSeed().estates.find((e) => e.id === "okafor")!;
  const workspace: Estate = {
    ...base,
    id: "kemp",
    ref: "HM-0101",
    deceased: { firstName: "Doris", fullName: "Doris Jean Kemp", shortName: "Doris Kemp", dateOfDeath: "2026-03-02" },
    feeEarnerId: m.id,
    clientPartyId: "p_kemp_client",
    parties: [{ id: "p_kemp_client", name: "Ruth Kemp", initials: "RK", role: "executor", relationship: "daughter", color: "#E3A13A", portalStatus: "active" }],
    tasks: [{ id: "kemp_t1", title: "Check Registry status", owner: { kind: "firm", staffId: m.id }, due: "Today", done: false }],
    blocker: "Probate Registry · applied 4 weeks ago",
  };
  const [row] = await db
    .insert(schema.estate)
    .values({ firmId: firm.id, ref: "HM-0101", slug: "kemp", deceasedFullName: "Doris Jean Kemp", dateOfDeath: "2026-03-02", feeEarnerId: m.id, workspace })
    .returning();
  await db.insert(schema.estateParty).values({
    firmId: firm.id,
    estateId: row.id,
    userId: ruthId,
    role: "executor",
    fullName: "Ruth Kemp",
    email: SEED_USERS.ruth,
    workspaceKey: "p_kemp_client",
    invitedAt: new Date(),
    acceptedAt: new Date(),
  });
  await db.insert(schema.auditEvent).values({ firmId: firm.id, estateId: row.id, actorType: "system", action: "seed.import", entityType: "estate", entityId: row.id, summary: "Seeded demo estate" });
  console.log("Seeded Hartley Moss: 1 estate, 1 staff, 1 family user.");
}

async function main() {
  const db = getAdminDb();
  await seedEllisRowe(db);
  await seedHartleyMoss(db);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(2, 0, 0, 0);
  await enqueue(db, { firmId: null, kind: "audit.verify", runAt: tomorrow, dedupeKey: `audit.verify:${tomorrow.toISOString().slice(0, 10)}` });
  console.log(`Staff password: ${PASSWORD === "waymark-demo-password" ? "waymark-demo-password (default)" : "from SEED_STAFF_PASSWORD"}`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
