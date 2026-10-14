import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reducer } from "@/lib/reducer";
import { buildSeed } from "@/lib/seed";

const NOW = new Date("2026-10-14T09:00:00Z");
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

const ellis = (s: ReturnType<typeof buildSeed>) => s.estates.find((e) => e.id === "ellis")!;

describe("reducer", () => {
  it("approving the Barclays draft completes its task, posts an update and changes who we wait on", () => {
    const s0 = buildSeed(NOW);
    const s1 = reducer(s0, { type: "approveDraft", estateId: "ellis", draftId: "dr_barclays" });
    const e = ellis(s1);
    const d = e.drafts.find((x) => x.id === "dr_barclays")!;
    expect(d.status).toBe("sent");
    expect(d.decidedAt).toMatch(ISO);
    const t = e.tasks.find((x) => x.id === "t_barclays")!;
    expect(t.done).toBe(true);
    expect(t.doneAt).toBe(NOW.toISOString());
    expect(e.updates[0]).toMatchObject({ title: "We've written to Barclays on your behalf", at: NOW.toISOString() });
    // Barclays no longer blocks: Ellis now waits on Sarah and needs no attention.
    expect(ellis(s0).waitingOn).toBe("bank");
    expect(e.waitingOn).toBe("family");
    expect(e.attention).toBe(false);
  });

  it("stamps real dates on uploads, messages, notes and new tasks", () => {
    let s = buildSeed(NOW);
    s = reducer(s, { type: "uploadDocument", estateId: "ellis", docId: "d_funeral", name: "Funeral invoice", fileName: "invoice.png" });
    s = reducer(s, { type: "sendMessage", estateId: "ellis", from: "client", text: "Done" });
    s = reducer(s, { type: "addNote", estateId: "ellis", text: "Called Sarah" });
    s = reducer(s, { type: "addTask", estateId: "ellis", title: "Order Land Registry title", owner: { kind: "firm", staffId: "s_ps" }, dueOn: "2026-10-21" });
    const e = ellis(s);
    expect(e.documents.find((d) => d.id === "d_funeral")).toMatchObject({ state: "checking", uploadedAt: NOW.toISOString() });
    expect(e.tasks.find((t) => t.title === "Check Funeral invoice from Sarah")).toMatchObject({ dueOn: "2026-10-14", done: false });
    expect(e.tasks.find((t) => t.id === "t_funeral")?.done).toBe(true);
    expect(e.messages.at(-1)?.sentAt).toBe(NOW.toISOString());
    expect(e.notes[0].at).toBe(NOW.toISOString());
    expect(e.tasks[0]).toMatchObject({ title: "Order Land Registry title", dueOn: "2026-10-21", createdAt: NOW.toISOString() });
  });

  it("does not let a sent draft be edited or approved twice", () => {
    let s = buildSeed(NOW);
    s = reducer(s, { type: "approveDraft", estateId: "ellis", draftId: "dr_barclays" });
    const updates = ellis(s).updates.length;
    s = reducer(s, { type: "approveDraft", estateId: "ellis", draftId: "dr_barclays" });
    s = reducer(s, { type: "editDraft", estateId: "ellis", draftId: "dr_barclays", body: ["changed"] });
    expect(ellis(s).updates.length).toBe(updates);
    expect(ellis(s).drafts.find((d) => d.id === "dr_barclays")?.body[0]).toBe("Dear Sir or Madam,");
  });

  it("opens a new estate at stage 1 with dated starter tasks", () => {
    const s = reducer(buildSeed(NOW), { type: "createEstate", id: "est_abc123", deceasedName: "Walter Hughes", clientName: "Anne Hughes", clientEmail: "anne@example.com", feeEarnerId: "s_ps" });
    const e = s.estates.find((x) => x.id === "est_abc123")!;
    expect(e.stage).toBe(0);
    expect(e.daysOpen).toBe(0);
    expect(e.openedAt).toBe(NOW.toISOString());
    expect(e.tasks.map((t) => t.dueOn)).toEqual(["2026-10-19", "2026-10-21"]);
    expect(e.waitingOn).toBe("family");
  });
});
