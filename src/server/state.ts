import "server-only";
import { asc, eq } from "drizzle-orm";
import { schema, type Tx } from "@/db/client";
import { SEED_VERSION } from "@/lib/seed";
import type { DemoState } from "@/lib/types";
import { loadEstates } from "./estate-store";
import type { FamilyViewer, StaffViewer } from "./viewer";

const ROLE_TITLE: Record<string, string> = { firm_admin: "Administrator", partner: "Partner", fee_earner: "Fee earner", paralegal: "Paralegal" };

/**
 * Build the screens' state from the database. Must be called inside
 * withTenant(): row-level security decides which estates and rows come back.
 */
export async function loadState(tx: Tx, viewer: StaffViewer | FamilyViewer): Promise<DemoState & { uuidBySlug: Map<string, string> }> {
  const [f] = await tx.select().from(schema.firm).limit(1);
  if (!f) throw new Error("Firm not visible in this context");

  const staffRows = await tx
    .select({ m: schema.membership, name: schema.user.name })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .where(eq(schema.membership.active, true))
    .orderBy(asc(schema.membership.createdAt));
  const staff = staffRows.map(({ m, name }) => ({ id: m.id, name, initials: m.initials, role: m.title ?? ROLE_TITLE[m.role], color: m.color }));
  const staffByUser = new Map(staffRows.map(({ m }) => [m.userId, m.id]));

  const { estates, uuidBySlug } = await loadEstates(tx, { staff, staffByUser, scope: viewer.kind === "staff" ? "firm" : "portal" });

  let currentClientEstateId = estates[0]?.id ?? "";
  let onboarded = true;
  if (viewer.kind === "family") {
    const parties = await tx.select().from(schema.estateParty).where(eq(schema.estateParty.userId, viewer.userId));
    const mine = [...uuidBySlug.entries()].find(([, uuid]) => parties.some((p) => p.estateId === uuid));
    if (mine) currentClientEstateId = mine[0];
    const party = parties.find((p) => p.estateId === mine?.[1]);
    onboarded = Boolean(party?.acceptedAt);
  }

  return {
    version: SEED_VERSION,
    firm: { id: f.id, name: f.name, shortName: f.shortName, town: f.town ?? "" },
    staff,
    currentStaffId: viewer.kind === "staff" ? viewer.membershipId : (staff[0]?.id ?? ""),
    currentClientEstateId,
    onboarded,
    estates,
    uuidBySlug,
  };
}

/** Strip server-only helpers before sending state to the browser. */
export function forClient(s: DemoState & { uuidBySlug?: unknown }): DemoState {
  const { uuidBySlug: _drop, ...rest } = s;
  void _drop;
  return rest;
}
