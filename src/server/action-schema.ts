import { z } from "zod";
import type { Action } from "@/lib/reducer";

/**
 * Validation for actions arriving from the browser. Server actions accept
 * arbitrary input, so every field is checked before the reducer runs.
 */
const idStr = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const owner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("firm"), staffId: idStr }),
  z.object({ kind: z.literal("family"), partyId: idStr }),
  z.object({ kind: z.literal("third"), label: text(80) }),
]);
const assetKind = z.enum(["property", "bank", "savings", "bonds", "pension", "investment", "credit", "utility", "other"]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("toggleTask"), estateId: idStr, taskId: idStr }),
  z.object({ type: z.literal("addTask"), estateId: idStr, title: text(200), owner, due: text(40) }),
  z.object({ type: z.literal("editDraft"), estateId: idStr, draftId: idStr, body: z.array(text(4000)).min(1).max(40) }),
  z.object({ type: z.literal("approveDraft"), estateId: idStr, draftId: idStr }),
  z.object({ type: z.literal("discardDraft"), estateId: idStr, draftId: idStr }),
  z.object({ type: z.literal("resolveMissing"), estateId: idStr, missingId: idStr }),
  z.object({ type: z.literal("acceptExtraction"), estateId: idStr, extractionId: idStr }),
  z.object({ type: z.literal("markDocChecked"), estateId: idStr, docId: idStr }),
  z.object({ type: z.literal("uploadDocument"), estateId: idStr, docId: idStr.optional(), name: text(120), fileName: text(200) }),
  z.object({
    type: z.literal("addAsset"),
    estateId: idStr,
    by: z.enum(["firm", "family"]),
    kind: assetKind,
    name: text(160),
    institution: z.string().trim().max(160),
    valuePence: z.number().int().min(0).max(1_000_000_000_00).nullable(),
    liability: z.boolean(),
  }),
  z.object({ type: z.literal("sendMessage"), estateId: idStr, from: z.enum(["client", "firm"]), text: text(4000), attachment: text(200).optional() }),
  z.object({ type: z.literal("addNote"), estateId: idStr, text: text(4000) }),
  z.object({ type: z.literal("createEstate"), id: z.string().regex(/^est_[a-z0-9]{4,40}$/), deceasedName: text(160), clientName: text(160), clientEmail: z.string().trim().email().max(254), feeEarnerId: z.string().uuid() }),
  z.object({ type: z.literal("completeOnboarding"), deceasedName: text(160), relationship: text(60) }),
]);

export type CheckedAction = z.infer<typeof actionSchema> & Action;

/** Actions a family member may run from the portal. */
export const FAMILY_ACTIONS = new Set(["uploadDocument", "addAsset", "sendMessage", "completeOnboarding"]);
/** Actions only staff may run. */
export const STAFF_ONLY = new Set(["toggleTask", "addTask", "editDraft", "approveDraft", "discardDraft", "resolveMissing", "acceptExtraction", "markDocChecked", "addNote", "createEstate"]);
