import { z } from "zod";
import { isValidDate } from "@/rules/util";
import type { Action } from "@/lib/reducer";

/**
 * Validation for actions arriving from the browser. Server actions accept
 * arbitrary input, so every field is checked before the reducer runs.
 */
const idStr = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
/** A real calendar date (rejects 2024-02-30). */
const isoDate = z.string().refine(isValidDate, "Not a real date");
const text = (max: number) => z.string().trim().min(1).max(max);
const owner = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("firm"), staffId: idStr }),
  z.object({ kind: z.literal("family"), partyId: idStr }),
  z.object({ kind: z.literal("third"), label: text(80), category: z.enum(["bank", "hmrc", "registry", "other"]) }),
]);
const assetKind = z.enum(["property", "bank", "savings", "bonds", "pension", "investment", "credit", "utility", "other"]);
const pence = z.number().int().min(0).max(1_000_000_000_00);
const bp = z.number().int().min(0).max(10_000);
const taxCategory = z.enum(["spouse", "charity", "lineal_descendant", "other"]);
const relief = z.object({ kind: z.enum(["business", "agricultural"]), rate: z.enum(["full", "half"]) });
const person: z.ZodType<{ name: string; alive: boolean; descendants?: unknown[] }> = z.lazy(() =>
  z.object({ name: text(120), alive: z.boolean(), descendants: z.array(person).max(30).optional() }),
);
const people = z.array(person).max(30);
const names = z.array(text(120)).max(10);
const family = z.object({
  spouseName: text(120).optional(),
  issue: people,
  parents: names,
  siblingsWhole: people,
  siblingsHalf: people,
  grandparents: names,
  auntsUnclesWhole: people,
  auntsUnclesHalf: people,
});
const taxPatch = z
  .object({
    longTermUkResident: z.boolean(),
    spouseExemptionLimited: z.boolean(),
    transferredNrbBp: bp,
    transferredRnrbBp: bp,
    predeceasedSpouse: z.object({ name: text(160), diedOn: isoDate.optional() }).nullable(),
    downsizing: z.object({ disposedOn: isoDate, formerResidenceValuePence: pence }).nullable(),
    reliefAllowanceTransferredPence: pence.nullable(),
    residueBenham: z.boolean(),
    mergeCharityComponents: z.boolean(),
  })
  .partial()
  .strict();

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("toggleTask"), estateId: idStr, taskId: idStr }),
  z.object({ type: z.literal("addTask"), estateId: idStr, title: text(200), owner, dueOn: isoDate.nullable() }),
  z.object({ type: z.literal("editDraft"), estateId: idStr, draftId: idStr, body: z.array(text(4000)).min(1).max(40) }),
  z.object({ type: z.literal("approveDraft"), estateId: idStr, draftId: idStr }),
  z.object({ type: z.literal("discardDraft"), estateId: idStr, draftId: idStr }),
  z.object({ type: z.literal("resolveMissing"), estateId: idStr, missingId: idStr }),
  z.object({ type: z.literal("acceptExtraction"), estateId: idStr, extractionId: idStr }),
  z.object({ type: z.literal("markDocChecked"), estateId: idStr, docId: idStr }),
  z.object({ type: z.literal("uploadDocument"), estateId: idStr, docId: idStr.optional(), name: text(120), fileName: text(200), fileId: z.string().uuid().optional() }),
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
  // Inheritance tax (milestone 3).
  z.object({ type: z.literal("updateTaxProfile"), estateId: idStr, patch: taxPatch }),
  z.object({ type: z.literal("setPartyTaxCategory"), estateId: idStr, partyId: idStr, category: taxCategory.nullable() }),
  z.object({
    type: z.literal("setAssetTax"),
    estateId: idStr,
    assetId: idStr,
    tax: z
      .object({
        ownership: z.enum(["sole", "joint_tenancy", "tenancy_in_common"]),
        survivorPartyId: idStr,
        qualifyingResidence: z.boolean(),
        relief,
        pension: z.enum(["unused_fund", "death_in_service", "dependants_scheme_pension"]),
        pensionRecipientPartyId: idStr,
        foreign: z.boolean(),
        securedOnAssetId: idStr,
        deductible: z.boolean(),
      })
      .partial()
      .strict(),
  }),
  z.object({ type: z.literal("setWillGiftTax"), estateId: idStr, giftId: idStr, assetId: idStr.nullable(), bearsOwnTax: z.boolean() }),
  z.object({
    type: z.literal("addLifetimeGift"),
    estateId: idStr,
    gift: z
      .object({
        madeOn: isoDate,
        valuePence: pence.refine((v) => v > 0),
        description: text(200),
        recipientPartyId: idStr.optional(),
        recipientName: text(160).optional(),
        recipientCategory: taxCategory,
        form: z.enum(["outright", "trust"]),
        lifetimeTaxPaidPence: pence.optional(),
        smallGift: z.boolean().optional(),
        weddingGift: z.enum(["child", "grandchild", "other"]).optional(),
        normalExpenditure: z.boolean().optional(),
        relief: relief.extend({ stillQualifiesAtDeath: z.boolean() }).optional(),
      })
      .strict(),
  }),
  z.object({ type: z.literal("voidLifetimeGift"), estateId: idStr, giftId: idStr }),
  z.object({
    type: z.literal("addPriorTransfer"),
    estateId: idStr,
    transfer: z.object({ label: text(160), transferOn: isoDate, netIncreasePence: pence, grossTransferPence: pence.refine((v) => v > 0), taxPaidPence: pence }).strict(),
  }),
  z.object({ type: z.literal("voidPriorTransfer"), estateId: idStr, transferId: idStr }),
  z.object({ type: z.literal("setIntestacyFamily"), estateId: idStr, family: family.nullable() }),
  z.object({ type: z.literal("confirmIhtFlag"), estateId: idStr, code: z.string().min(1).max(160), message: text(1000) }),
]);

export type CheckedAction = z.infer<typeof actionSchema> & Action;

/** Actions a family member may run from the portal. */
export const FAMILY_ACTIONS = new Set(["uploadDocument", "addAsset", "sendMessage", "completeOnboarding"]);
/** Actions only staff may run. */
export const STAFF_ONLY = new Set([
  "toggleTask",
  "addTask",
  "editDraft",
  "approveDraft",
  "discardDraft",
  "resolveMissing",
  "acceptExtraction",
  "markDocChecked",
  "addNote",
  "createEstate",
  "updateTaxProfile",
  "setPartyTaxCategory",
  "setAssetTax",
  "setWillGiftTax",
  "addLifetimeGift",
  "voidLifetimeGift",
  "addPriorTransfer",
  "voidPriorTransfer",
  "setIntestacyFamily",
  "confirmIhtFlag",
]);
