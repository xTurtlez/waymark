"use server";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, schema, withTenant } from "@/db/client";
import { reducer } from "@/lib/reducer";
import type { DemoState, Estate } from "@/lib/types";

/** Collections and fields worth auditing (derived values and the trail itself are left out). */
function stripForAudit(e: Estate): Record<string, unknown> {
  const { audit: _a, stage: _s, daysOpen: _d, waitingOn: _w, blocker: _b, attention: _t, ...rest } = e;
  void [_a, _s, _d, _w, _b, _t];
  return rest as Record<string, unknown>;
}
import { actionSchema, FAMILY_ACTIONS, STAFF_ONLY, type CheckedAction } from "./action-schema";
import { diffEstate, writeAudit } from "./audit";
import { env } from "./env";
import { emailHtml, sendMail } from "./mail";
import { saveEstate } from "./estate-store";
import { forClient, loadState } from "./state";
import { getViewer, tenantOf } from "./viewer";

type Result = { ok: true; state: DemoState } | { ok: false; error: string; state?: DemoState };

const SUMMARY: Record<string, string> = {
  toggleTask: "Task updated",
  addTask: "Task added",
  editDraft: "AI draft edited",
  approveDraft: "AI draft approved and sent",
  discardDraft: "AI draft discarded",
  resolveMissing: "Missing item actioned",
  acceptExtraction: "Extracted fields accepted",
  markDocChecked: "Document checked",
  uploadDocument: "Document uploaded",
  addAsset: "Asset added",
  sendMessage: "Message sent",
  addNote: "File note added",
  createEstate: "Estate opened",
  completeOnboarding: "Portal setup completed",
  updateTaxProfile: "IHT details updated",
  setPartyTaxCategory: "Beneficiary IHT treatment updated",
  setAssetTax: "Holding IHT treatment updated",
  setWillGiftTax: "Will gift linked",
  addLifetimeGift: "Lifetime gift recorded",
  voidLifetimeGift: "Lifetime gift withdrawn",
  addPriorTransfer: "Earlier estate recorded",
  voidPriorTransfer: "Earlier estate withdrawn",
  setIntestacyFamily: "Intestacy family recorded",
  confirmIhtFlag: "IHT point confirmed by a solicitor",
};

/** Create (or find) the auth user for an invited executor. Privileged: runs outside tenant scope. */
async function ensureUser(email: string, name: string): Promise<string> {
  const db = getDb();
  const lower = email.toLowerCase();
  const [existing] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(sql`lower(${schema.user.email})`, lower)).limit(1);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.insert(schema.user).values({ id, name, email: lower, emailVerified: false });
  return id;
}

/**
 * Apply one store action for the signed-in user. Re-checks permissions,
 * runs the shared reducer inside an RLS-scoped transaction, persists the
 * changed estates, writes the audit log and returns the new state.
 */
export async function applyAction(input: unknown): Promise<Result> {
  const viewer = await getViewer();
  if (!viewer || viewer.kind === "none") return { ok: false, error: "Your session has ended. Please sign in again." };

  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That request wasn't valid." };
  const action = parsed.data as CheckedAction;

  const family = viewer.kind === "family";
  if (family && !FAMILY_ACTIONS.has(action.type)) return { ok: false, error: "You don't have permission to do that." };
  if (!family && (action.type === "completeOnboarding" || !(STAFF_ONLY.has(action.type) || FAMILY_ACTIONS.has(action.type)))) {
    return { ok: false, error: "You don't have permission to do that." };
  }
  // The caller's side is decided by the server, never by the client.
  if (action.type === "sendMessage") action.from = family ? "client" : "firm";
  if (action.type === "addAsset") action.by = family ? "family" : "firm";

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent");

  // Invited executors need an account before the estate row references them.
  let inviteUserId: string | null = null;
  if (action.type === "createEstate") inviteUserId = await ensureUser(action.clientEmail, action.clientName);

  try {
    const result = await withTenant(tenantOf(viewer), async (tx) => {
      const slug = "estateId" in action ? action.estateId : null;
      if (slug) {
        // Serialise concurrent edits to the same estate.
        const locked = await tx.select({ id: schema.estate.id }).from(schema.estate).where(eq(schema.estate.slug, slug)).for("update");
        if (!locked.length) throw new Error("NOT_FOUND");
      }
      const before = await loadState(tx, viewer);
      if (family && slug && slug !== before.currentClientEstateId) throw new Error("FORBIDDEN");
      const saveCtx = (estateUuid: string) => ({ firmId: viewer.firmId, estateUuid, actorMembershipId: family ? null : viewer.membershipId, actorUserId: viewer.userId, scope: family ? ("portal" as const) : ("firm" as const) });
      const auditBase = { firmId: viewer.firmId, actorType: family ? ("family" as const) : ("staff" as const), actorUserId: viewer.userId, action: action.type, ip, userAgent };

      if (action.type === "createEstate") {
        // Server-assigned reference, unique per firm.
        const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(nullif(regexp_replace(${schema.estate.ref}, '\\D', '', 'g'), '')::int), 0)` }).from(schema.estate);
        const next = reducer(before, action);
        const created = next.estates.find((e) => e.id === action.id);
        if (!created) throw new Error("CREATE_FAILED");
        created.ref = `HRT-${String(Number(max) + 1).padStart(4, "0")}`;
        const estateUuid = crypto.randomUUID();
        await tx.insert(schema.estate).values({
          id: estateUuid,
          firmId: viewer.firmId,
          ref: created.ref,
          slug: created.id,
          deceasedFullName: created.deceased.fullName,
          deceasedFirstName: created.deceased.firstName,
          deceasedShortName: created.deceased.shortName,
          feeEarnerId: action.feeEarnerId,
          openedAt: new Date(created.openedAt),
        });
        await saveEstate(tx, saveCtx(estateUuid), null, created);
        await tx
          .update(schema.estateParty)
          .set({ userId: inviteUserId, invitedAt: new Date() })
          .where(and(eq(schema.estateParty.estateId, estateUuid), eq(schema.estateParty.key, created.clientPartyId)));
        await writeAudit(tx, {
          ...auditBase,
          estateId: estateUuid,
          entityType: "estate",
          entityId: estateUuid,
          summary: `Estate opened for ${created.deceased.fullName}; portal invitation sent to ${action.clientEmail}`,
          after: { ref: created.ref, deceased: created.deceased.fullName, executor: action.clientName },
        });
        return { state: await loadState(tx, viewer), invite: { name: action.clientName, email: action.clientEmail, deceased: created.deceased.fullName } };
      }

      const next = reducer(before, action);

      if (action.type === "completeOnboarding") {
        const estateUuid = before.uuidBySlug.get(before.currentClientEstateId);
        if (estateUuid) {
          await tx
            .update(schema.estateParty)
            .set({ acceptedAt: new Date() })
            .where(and(eq(schema.estateParty.estateId, estateUuid), eq(schema.estateParty.userId, viewer.userId)));
        }
      }

      // Save each estate the reducer changed, and audit it with row-level before/after.
      const prev = new Map(before.estates.map((e) => [e.id, e]));
      for (const e of next.estates) {
        const old = prev.get(e.id);
        if (!old) continue;
        const d = diffEstate(stripForAudit(old), stripForAudit(e));
        const newest = e.audit.find((x) => !old.audit.some((y) => y.id === x.id));
        if (!Object.keys(d.after).length && !Object.keys(d.before).length && !newest) continue;
        const estateUuid = before.uuidBySlug.get(e.id);
        if (!estateUuid) throw new Error("FORBIDDEN");
        await saveEstate(tx, saveCtx(estateUuid), old, e);
        await writeAudit(tx, {
          ...auditBase,
          estateId: estateUuid,
          entityType: "estate",
          entityId: estateUuid,
          summary: newest?.text ?? SUMMARY[action.type],
          before: d.before,
          after: d.after,
        });
      }
      return { state: await loadState(tx, viewer), invite: null };
    });

    if (result.invite) {
      const url = `${env().BETTER_AUTH_URL}/sign-in?as=family&email=${encodeURIComponent(result.invite.email)}`;
      await sendMail({
        firmId: viewer.firmId,
        to: result.invite.email,
        subject: `${result.state.firm.name} has invited you to Waymark`,
        text: `Dear ${result.invite.name},\n\nWe're sorry for your loss. ${result.state.firm.name} uses Waymark to keep you informed about ${result.invite.deceased}'s estate and to ask for the few things they need from you, one step at a time.\n\nSign in with this email address here: ${url}\n\nThere's no rush.`,
        html: emailHtml(
          `${result.state.firm.name} has invited you to Waymark`,
          [
            `Dear ${result.invite.name},`,
            `We're sorry for your loss. ${result.state.firm.name} uses Waymark to keep you informed about ${result.invite.deceased}'s estate and to ask for the few things they need from you, one step at a time.`,
            "There's no rush. Sign in whenever you're ready, using this email address.",
          ],
          { label: "Open your portal", url },
        ),
      }).catch(() => undefined);
    }
    return { ok: true, state: forClient(result.state) };
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "NOT_FOUND") return { ok: false, error: "That estate could not be found." };
    if (code === "FORBIDDEN") return { ok: false, error: "You don't have permission to do that." };
    console.error("applyAction failed", err);
    return { ok: false, error: "That didn't save. Please try again." };
  }
}
