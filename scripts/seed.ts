import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { closeDb, getAdminDb, schema } from "../src/db/client";
import { freshSeed } from "../src/lib/seed";
import type { Estate } from "../src/lib/types";
import { saveEstate } from "../src/server/estate-store";
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

/** Write one estate (row, parties, every child record) and import its demo history into the audit log. */
async function writeEstate(db: Db, firmId: string, e: Estate, users: { byPartyKey: Record<string, string>; byMembership: Record<string, string> }) {
  await db.transaction(async (tx) => {
    const estateUuid = crypto.randomUUID();
    await tx.insert(schema.estate).values({
      id: estateUuid,
      firmId,
      ref: e.ref,
      slug: e.id,
      deceasedFullName: e.deceased.fullName,
      deceasedFirstName: e.deceased.firstName,
      deceasedShortName: e.deceased.shortName,
      feeEarnerId: e.feeEarnerId || null,
      openedAt: new Date(e.openedAt),
    });
    await saveEstate(tx, { firmId, estateUuid, actorMembershipId: null, actorUserId: "seed", scope: "firm" }, null, e);
    // Link family members who have portal accounts.
    for (const [key, userId] of Object.entries(users.byPartyKey)) {
      await tx
        .update(schema.estateParty)
        .set({ userId, invitedAt: new Date(e.openedAt), acceptedAt: new Date(new Date(e.openedAt).getTime() + 9 * 3600_000) })
        .where(and(eq(schema.estateParty.estateId, estateUuid), eq(schema.estateParty.key, key)));
    }
    // History, oldest first so the hash chain follows time.
    const history = [...e.audit].sort((x, y) => (x.at < y.at ? -1 : 1));
    await tx.insert(schema.auditEvent).values({
      firmId,
      estateId: estateUuid,
      actorType: "system",
      action: "seed.import",
      entityType: "estate",
      entityId: estateUuid,
      summary: `Estate opened: ${e.deceased.fullName} (${e.ref})`,
      createdAt: new Date(e.openedAt),
    });
    for (const h of history) {
      const staffUser = users.byMembership[h.actor];
      const familyUser = users.byPartyKey[h.actor];
      await tx.insert(schema.auditEvent).values({
        firmId,
        estateId: estateUuid,
        actorType: h.actor === "ai" ? "ai" : staffUser ? "staff" : familyUser ? "family" : "system",
        actorUserId: staffUser ?? familyUser ?? null,
        action: "seed.history",
        entityType: "estate",
        entityId: estateUuid,
        summary: h.text,
        createdAt: new Date(h.at),
      });
    }
  });
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
  const membershipUser: Record<string, string> = {};
  for (const def of staffDefs) {
    const s = seed.staff.find((x) => x.id === def.key)!;
    const userId = await createUser(db, def.email, s.name, PASSWORD);
    const [m] = await db
      .insert(schema.membership)
      .values({ firmId: firm.id, userId, role: def.role, title: s.role, initials: s.initials, color: s.color })
      .returning();
    keyToMembership[def.key] = m.id;
    membershipUser[m.id] = userId;
  }

  const sarahId = await createUser(db, SEED_USERS.sarah, "Sarah Ellis");
  for (const raw of seed.estates) {
    const e = remapStaff<Estate>(raw, keyToMembership);
    await writeEstate(db, firm.id, e, { byPartyKey: e.id === "ellis" ? { p_sarah: sarahId } : {}, byMembership: membershipUser });
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
  const now = new Date().toISOString();
  const kemp: Estate = {
    ...base,
    id: "kemp",
    ref: "HM-0101",
    deceased: { firstName: "Doris", fullName: "Doris Jean Kemp", shortName: "Doris Kemp", dateOfDeath: base.deceased.dateOfDeath },
    feeEarnerId: m.id,
    clientPartyId: "p_kemp_client",
    parties: [{ id: "p_kemp_client", name: "Ruth Kemp", initials: "RK", role: "executor", relationship: "daughter", email: SEED_USERS.ruth, color: "#E3A13A", portalStatus: "active" }],
    tasks: [{ id: "kemp_t1", title: "Check Registry status", owner: { kind: "firm", staffId: m.id }, dueOn: now.slice(0, 10), done: false, createdAt: now }],
    audit: [],
  };
  await writeEstate(db, firm.id, kemp, { byPartyKey: { p_kemp_client: ruthId }, byMembership: { [m.id]: owenId } });
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
