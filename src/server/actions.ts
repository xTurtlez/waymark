"use server";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb, schema, withTenant } from "@/db/client";
import { reducer } from "@/lib/reducer";
import type { DemoState, Estate } from "@/lib/types";
import { actionSchema, FAMILY_ACTIONS, STAFF_ONLY, type CheckedAction } from "./action-schema";
import { diffEstate, writeAudit } from "./audit";
import { env } from "./env";
import { emailHtml, sendMail } from "./mail";
import { loadState } from "./state";
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

      // Server-assigned reference for new estates (unique per firm).
      if (action.type === "createEstate") {
        const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(nullif(regexp_replace(${schema.estate.ref}, '\\D', '', 'g'), '')::int), 0)` }).from(schema.estate);
        const next = reducer(before, action);
        const created = next.estates.find((e) => e.id === action.id);
        if (!created) throw new Error("CREATE_FAILED");
        created.ref = `HRT-${String(Number(max) + 1).padStart(4, "0")}`;
        const [row] = await tx
          .insert(schema.estate)
          .values({
            firmId: viewer.firmId,
            ref: created.ref,
            slug: created.id,
            deceasedFullName: created.deceased.fullName,
            feeEarnerId: action.feeEarnerId,
            workspace: created,
          })
          .returning({ id: schema.estate.id });
        const clientParty = created.parties.find((p) => p.id === created.clientPartyId);
        await tx.insert(schema.estateParty).values({
          firmId: viewer.firmId,
          estateId: row.id,
          userId: inviteUserId,
          role: "executor",
          fullName: action.clientName,
          email: action.clientEmail.toLowerCase(),
          workspaceKey: clientParty?.id ?? null,
          invitedAt: new Date(),
        });
        await writeAudit(tx, {
          firmId: viewer.firmId,
          estateId: row.id,
          actorType: "staff",
          actorUserId: viewer.userId,
          action: action.type,
          entityType: "estate",
          entityId: row.id,
          summary: `Estate opened for ${created.deceased.fullName}; portal invitation sent to ${action.clientEmail}`,
          after: { ref: created.ref, deceased: created.deceased.fullName, executor: action.clientName },
          ip,
          userAgent,
        });
        return { state: await loadState(tx, viewer), invite: { name: action.clientName, email: action.clientEmail, deceased: created.deceased.fullName } };
      }

      const next = reducer(before, action);

      if (action.type === "completeOnboarding") {
        const estateRow = await tx.select({ id: schema.estate.id }).from(schema.estate).where(eq(schema.estate.slug, before.currentClientEstateId));
        if (estateRow[0]) {
          await tx
            .update(schema.estateParty)
            .set({ acceptedAt: new Date() })
            .where(and(eq(schema.estateParty.estateId, estateRow[0].id), eq(schema.estateParty.userId, viewer.userId)));
        }
      }

      // Persist each estate the reducer changed.
      const prev = new Map(before.estates.map((e) => [e.id, e]));
      for (const e of next.estates) {
        const old = prev.get(e.id);
        if (!old || JSON.stringify(old) === JSON.stringify(e)) continue;
        const [row] = await tx
          .update(schema.estate)
          .set({ workspace: e as Estate, version: sql`${schema.estate.version} + 1`, updatedAt: new Date() })
          .where(eq(schema.estate.slug, e.id))
          .returning({ id: schema.estate.id });
        if (!row) throw new Error("FORBIDDEN");
        const d = diffEstate(old as unknown as Record<string, unknown>, e as unknown as Record<string, unknown>);
        const newest = e.audit[0];
        const summary = newest && !old.audit.some((x) => x.id === newest.id) ? newest.text : SUMMARY[action.type];
        await writeAudit(tx, {
          firmId: viewer.firmId,
          estateId: row.id,
          actorType: family ? "family" : "staff",
          actorUserId: viewer.userId,
          action: action.type,
          entityType: "estate",
          entityId: row.id,
          summary,
          before: d.before,
          after: d.after,
          ip,
          userAgent,
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
    return { ok: true, state: result.state };
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "NOT_FOUND") return { ok: false, error: "That estate could not be found." };
    if (code === "FORBIDDEN") return { ok: false, error: "You don't have permission to do that." };
    console.error("applyAction failed", err);
    return { ok: false, error: "That didn't save. Please try again." };
  }
}
