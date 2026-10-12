import "server-only";
import { asc, eq, ne } from "drizzle-orm";
import { schema, type Tx } from "@/db/client";
import { SEED_VERSION } from "@/lib/seed";
import type { DemoState, Estate } from "@/lib/types";
import type { FamilyViewer, StaffViewer } from "./viewer";

const ROLE_TITLE: Record<string, string> = { firm_admin: "Administrator", partner: "Partner", fee_earner: "Fee earner", paralegal: "Paralegal" };

/**
 * Build the client-side state from the database. Must be called inside
 * withTenant(): row-level security decides which estates come back.
 */
export async function loadState(tx: Tx, viewer: StaffViewer | FamilyViewer): Promise<DemoState> {
  const [f] = await tx.select().from(schema.firm).limit(1);
  if (!f) throw new Error("Firm not visible in this context");

  const staff = await tx
    .select({ m: schema.membership, name: schema.user.name })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .where(eq(schema.membership.active, true))
    .orderBy(asc(schema.membership.createdAt));

  const rows = await tx.select().from(schema.estate).where(ne(schema.estate.status, "archived")).orderBy(asc(schema.estate.openedAt), asc(schema.estate.ref));
  const estates: Estate[] = rows.map((r) => ({ ...(r.workspace as Estate), id: r.slug, ref: r.ref }));

  let currentClientEstateId = estates[0]?.id ?? "";
  let onboarded = true;
  if (viewer.kind === "family") {
    const parties = await tx.select().from(schema.estateParty).where(eq(schema.estateParty.userId, viewer.userId));
    const mine = rows.find((r) => parties.some((p) => p.estateId === r.id));
    if (mine) currentClientEstateId = mine.slug;
    const party = parties.find((p) => p.estateId === mine?.id);
    onboarded = Boolean(party?.acceptedAt);
  }

  return {
    version: SEED_VERSION,
    firm: { id: f.id, name: f.name, shortName: f.shortName, town: f.town ?? "" },
    staff: staff.map(({ m, name }) => ({ id: m.id, name, initials: m.initials, role: m.title ?? ROLE_TITLE[m.role], color: m.color })),
    currentStaffId: viewer.kind === "staff" ? viewer.membershipId : (staff[0]?.m.id ?? ""),
    currentClientEstateId,
    onboarded,
    estates,
  };
}
