import { describe, expect, it } from "vitest";
import { actionSchema, FAMILY_ACTIONS, STAFF_ONLY } from "@/server/action-schema";
import { diffEstate } from "@/server/audit";
import { backoffMs } from "@/server/jobs/queue";

describe("action validation", () => {
  it("accepts well-formed actions", () => {
    expect(actionSchema.safeParse({ type: "approveDraft", estateId: "ellis", draftId: "dr_barclays" }).success).toBe(true);
    expect(
      actionSchema.safeParse({ type: "addAsset", estateId: "ellis", by: "family", kind: "bank", name: "Lloyds account", institution: "Lloyds", valuePence: 250000, liability: false }).success,
    ).toBe(true);
  });
  it("rejects unknown types, bad ids and oversized input", () => {
    expect(actionSchema.safeParse({ type: "reset" }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "hydrate", state: {} }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "approveDraft", estateId: "../x", draftId: "d" }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "addNote", estateId: "ellis", text: "x".repeat(5000) }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "addAsset", estateId: "ellis", by: "family", kind: "bank", name: "A", institution: "", valuePence: 1.5, liability: false }).success).toBe(false);
    expect(actionSchema.safeParse({ type: "createEstate", id: "x", deceasedName: "A B", clientName: "C D", clientEmail: "c@d.com", feeEarnerId: "not-a-uuid" }).success).toBe(false);
  });
  it("keeps family and staff permissions disjoint", () => {
    for (const a of FAMILY_ACTIONS) expect(STAFF_ONLY.has(a)).toBe(false);
    expect(FAMILY_ACTIONS.has("approveDraft")).toBe(false);
    expect(FAMILY_ACTIONS.has("createEstate")).toBe(false);
  });
});

describe("diffEstate", () => {
  it("records only changed items in id-keyed arrays", () => {
    const before = { stage: 2, tasks: [{ id: "a", done: false }, { id: "b", done: false }], notes: [] };
    const after = { stage: 2, tasks: [{ id: "a", done: true }, { id: "b", done: false }], notes: [{ id: "n1", text: "hi" }] };
    const d = diffEstate(before, after);
    expect(d.before).toEqual({ tasks: [{ id: "a", done: false }] });
    expect(d.after).toEqual({ tasks: [{ id: "a", done: true }], notes: [{ id: "n1", text: "hi" }] });
  });
  it("records scalar changes and ignores unchanged keys", () => {
    expect(diffEstate({ stage: 2, ref: "X" }, { stage: 3, ref: "X" })).toEqual({ before: { stage: 2 }, after: { stage: 3 } });
  });
});

describe("job backoff", () => {
  it("grows exponentially and is capped", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(480_000);
    expect(backoffMs(20)).toBe(6 * 60 * 60 * 1000);
  });
});
