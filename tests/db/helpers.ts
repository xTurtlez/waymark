import { getAdminDb, schema } from "@/db/client";

/** Create an isolated firm with one estate and (optionally) a portal user. */
export async function makeFirm(label: string) {
  const db = getAdminDb();
  const tag = `${label}-${crypto.randomUUID().slice(0, 8)}`;
  const [firm] = await db.insert(schema.firm).values({ slug: tag, name: `Firm ${tag}`, shortName: tag }).returning();
  const staffUser = crypto.randomUUID();
  await db.insert(schema.user).values({ id: staffUser, name: "Staff", email: `staff-${tag}@test.example` });
  const [m] = await db.insert(schema.membership).values({ firmId: firm.id, userId: staffUser, role: "partner", initials: "ST" }).returning();
  const familyUser = crypto.randomUUID();
  await db.insert(schema.user).values({ id: familyUser, name: "Exec", email: `exec-${tag}@test.example` });
  const estates = await db
    .insert(schema.estate)
    .values([
      { firmId: firm.id, ref: `${tag}-1`, slug: `${tag}-one`, deceasedFullName: "One Person", deceasedFirstName: "One", deceasedShortName: "One Person" },
      { firmId: firm.id, ref: `${tag}-2`, slug: `${tag}-two`, deceasedFullName: "Two Person", deceasedFirstName: "Two", deceasedShortName: "Two Person" },
    ])
    .returning();
  await db.insert(schema.estateParty).values({ firmId: firm.id, estateId: estates[0].id, key: "p_exec", userId: familyUser, role: "executor", isPrimary: true, fullName: "Exec", initials: "EX" });
  return { firm, membership: m, staffUser, familyUser, estates };
}

/** Await a promise expected to fail and return the underlying Postgres error message. */
export async function dbError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (err) {
    const e = err as { message?: string; cause?: { message?: string } };
    return `${e.cause?.message ?? ""} ${e.message ?? ""}`;
  }
  throw new Error("Expected the database to reject this, but it succeeded");
}
