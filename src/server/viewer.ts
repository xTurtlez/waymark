import "server-only";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb, schema, type TenantContext } from "@/db/client";
import { getAuth } from "./auth";

export type StaffViewer = {
  kind: "staff";
  userId: string;
  name: string;
  email: string;
  firmId: string;
  membershipId: string;
  role: (typeof schema.firmRole.enumValues)[number];
  mfa: { totp: boolean; passkeys: number };
};
export type FamilyViewer = {
  kind: "family";
  userId: string;
  name: string;
  email: string;
  firmId: string;
  estateIds: string[];
};
export type Viewer = StaffViewer | FamilyViewer | { kind: "none"; userId: string; name: string; email: string };

/**
 * Who is signed in, and in which capacity. Uses the privileged connection
 * only to decide routing; all estate data is then read through withTenant().
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user;
  const db = getDb();

  const [m] = await db
    .select()
    .from(schema.membership)
    .where(and(eq(schema.membership.userId, u.id), eq(schema.membership.active, true)))
    .limit(1);
  if (m) {
    const [tf] = await db.select({ id: schema.twoFactor.id }).from(schema.twoFactor).where(eq(schema.twoFactor.userId, u.id)).limit(1);
    const pks = await db.select({ id: schema.passkey.id }).from(schema.passkey).where(eq(schema.passkey.userId, u.id));
    return {
      kind: "staff",
      userId: u.id,
      name: u.name,
      email: u.email,
      firmId: m.firmId,
      membershipId: m.id,
      role: m.role,
      mfa: { totp: Boolean(u.twoFactorEnabled) && Boolean(tf), passkeys: pks.length },
    };
  }

  const parties = await db.select().from(schema.estateParty).where(eq(schema.estateParty.userId, u.id));
  if (parties.length) {
    const firmId = parties[0].firmId;
    return { kind: "family", userId: u.id, name: u.name, email: u.email, firmId, estateIds: parties.filter((p) => p.firmId === firmId).map((p) => p.estateId) };
  }
  return { kind: "none", userId: u.id, name: u.name, email: u.email };
});

export function tenantOf(v: StaffViewer | FamilyViewer): TenantContext {
  return { firmId: v.firmId, userId: v.userId, scope: v.kind === "staff" ? "firm" : "portal" };
}
