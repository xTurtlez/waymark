"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Asset, AssetKind, DemoState, Draft, Estate, MissingItem, StageIndex, TaskOwner } from "./types";
import { SEED_VERSION, freshSeed } from "./seed";
import { stampNow, timeNow, uid } from "./format";
import { clientParty, feeEarner, firstName } from "./selectors";

/**
 * Demo store.
 *
 * One reducer holds both sides of the product so an action on the practice side
 * (approve a draft) shows up on the client side (an update) and vice versa.
 * State persists to localStorage and syncs across tabs, so you can open the
 * practice workspace and the client portal side by side.
 *
 * To move to a real backend, replace `dispatch` calls in `useActions` with API
 * calls and hydrate from the server; the action names map 1:1 to endpoints.
 */

const STORAGE_KEY = "waymark-demo";

type Action =
  | { type: "hydrate"; state: DemoState }
  | { type: "reset" }
  | { type: "toggleTask"; estateId: string; taskId: string }
  | { type: "addTask"; estateId: string; title: string; owner: TaskOwner; due: string }
  | { type: "editDraft"; estateId: string; draftId: string; body: string[] }
  | { type: "approveDraft"; estateId: string; draftId: string }
  | { type: "discardDraft"; estateId: string; draftId: string }
  | { type: "resolveMissing"; estateId: string; missingId: string }
  | { type: "acceptExtraction"; estateId: string; extractionId: string }
  | { type: "markDocChecked"; estateId: string; docId: string }
  | { type: "uploadDocument"; estateId: string; docId?: string; name: string; fileName: string }
  | { type: "addAsset"; estateId: string; by: "firm" | "family"; kind: AssetKind; name: string; institution: string; valuePence: number | null; liability: boolean }
  | { type: "sendMessage"; estateId: string; from: "client" | "firm"; text: string; attachment?: string }
  | { type: "addNote"; estateId: string; text: string }
  | { type: "createEstate"; id: string; deceasedName: string; clientName: string; clientEmail: string; feeEarnerId: string }
  | { type: "completeOnboarding"; deceasedName: string; relationship: string };

function today() {
  const d = new Date();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

function withEstate(state: DemoState, id: string, fn: (e: Estate, s: DemoState) => void): DemoState {
  const next = structuredClone(state);
  const e = next.estates.find((x) => x.id === id);
  if (e) fn(e, next);
  return next;
}

function audit(e: Estate, actorId: string, text: string) {
  e.audit.unshift({ id: uid("au"), at: stampNow(), actor: actorId, text });
}

function postUpdate(e: Estate, title: string, body: string, tone: "teal" | "coral" | "amber" | "plum" = "coral") {
  e.updates.unshift({ id: uid("u"), when: "Today", title, body, tone });
}

const ASSET_STATUS: Record<"firm" | "family", { firm: string; client: string }> = {
  firm: { firm: "Confirmed", client: "Confirmed" },
  family: { firm: "Added by family", client: "Priya will confirm" },
};

function avivaDraft(e: Estate, s: DemoState): Draft {
  const sol = feeEarner(s, e);
  return {
    id: uid("dr"),
    kind: "letter",
    title: "Notification to Aviva",
    to: "Aviva Bereavement Team",
    re: `${e.deceased.fullName}, pension`,
    body: [
      "Dear Sir or Madam,",
      `We act for the executor of the late ${e.deceased.fullName}, who died on [[14 May 2026]]. Her Barclays statements show a monthly pension credit from Aviva.`,
      "Please could you confirm the policy details, any lump sum or death benefit payable, and any overpayment since the date of death. A certified copy of the death certificate is enclosed.",
    ],
    signOff: `Yours faithfully,\n${s.firm.name}`,
    sources: "Barclays statement (monthly credit) · death certificate. Highlighted date pulled from certificate.",
    status: "review",
    createdAt: stampNow(),
    taskId: e.tasks.find((t) => /aviva/i.test(t.title) && t.owner.kind === "firm")?.id,
    clientUpdate: {
      title: `We've told Aviva about ${e.deceased.firstName}'s pension`,
      body: `${firstName(sol.name)} has asked for the policy details. Pension companies usually reply in 3 to 4 weeks.`,
    },
  };
}

function reducer(state: DemoState, a: Action): DemoState {
  switch (a.type) {
    case "hydrate":
      return a.state;
    case "reset":
      return freshSeed();

    case "toggleTask":
      return withEstate(state, a.estateId, (e, s) => {
        const t = e.tasks.find((x) => x.id === a.taskId);
        if (!t) return;
        t.done = !t.done;
        t.doneOn = t.done ? "Today" : undefined;
        audit(e, s.currentStaffId, `${firstName(s.staff.find((m) => m.id === s.currentStaffId)?.name ?? "")} ${t.done ? "completed" : "reopened"} “${t.title}”`);
      });

    case "addTask":
      return withEstate(state, a.estateId, (e, s) => {
        e.tasks.unshift({ id: uid("t"), title: a.title, owner: a.owner, due: a.due, done: false });
        audit(e, s.currentStaffId, `Task added: ${a.title}`);
      });

    case "editDraft":
      return withEstate(state, a.estateId, (e) => {
        const d = e.drafts.find((x) => x.id === a.draftId);
        if (d) {
          d.body = a.body;
          d.edited = true;
        }
      });

    case "approveDraft":
      return withEstate(state, a.estateId, (e, s) => {
        const d = e.drafts.find((x) => x.id === a.draftId);
        if (!d || d.status !== "review") return;
        d.status = "sent";
        const me = s.staff.find((m) => m.id === s.currentStaffId);
        audit(e, s.currentStaffId, `${firstName(me?.name ?? "")} approved and sent ${d.title.toLowerCase()} (AI draft${d.edited ? ", edited before sending" : ""})`);
        if (d.taskId) {
          const t = e.tasks.find((x) => x.id === d.taskId);
          if (t && !t.done) {
            t.done = true;
            t.doneOn = "Today";
          }
        }
        if (d.clientUpdate) postUpdate(e, d.clientUpdate.title, d.clientUpdate.body);
      });

    case "discardDraft":
      return withEstate(state, a.estateId, (e, s) => {
        const d = e.drafts.find((x) => x.id === a.draftId);
        if (!d) return;
        d.status = "discarded";
        audit(e, s.currentStaffId, `Discarded AI draft: ${d.title}`);
      });

    case "resolveMissing":
      return withEstate(state, a.estateId, (e, s) => {
        const m: MissingItem | undefined = e.missing.find((x) => x.id === a.missingId);
        if (!m || m.resolved) return;
        m.resolved = true;
        const client = clientParty(e);
        const sol = feeEarner(s, e);
        switch (m.actionKind) {
          case "draft-aviva": {
            const d = avivaDraft(e, s);
            e.drafts.unshift(d);
            audit(e, "ai", `Assistant drafted ${d.title.toLowerCase()}. Awaiting review.`);
            break;
          }
          case "remind-family": {
            const day = new Date().toLocaleDateString("en-GB", { weekday: "long" });
            e.messages.push({
              id: uid("msg"),
              from: "firm",
              authorId: sol.id,
              day,
              at: timeNow(),
              text: `Hi ${firstName(client.name)}, when you have a moment, could you add the funeral invoice? A photo is fine. I'll ask the bank to pay it directly.`,
            });
            audit(e, s.currentStaffId, `Reminder sent to ${client.name}: ${m.title.toLowerCase()}`);
            break;
          }
          case "request":
            audit(e, s.currentStaffId, `Requested title register from HM Land Registry (${m.title})`);
            break;
          case "id-check": {
            audit(e, s.currentStaffId, `ID check request sent to ${m.title.replace(" ID", "")}`);
            break;
          }
        }
      });

    case "acceptExtraction":
      return withEstate(state, a.estateId, (e, s) => {
        const x = e.extractions.find((y) => y.id === a.extractionId);
        if (!x || x.status !== "review") return;
        x.status = "accepted";
        const bal = x.fields.find((f) => /balance/i.test(f.key));
        const asset = e.assets.find((y) => y.id === x.assetId);
        if (asset) {
          if (bal) {
            const n = parseFloat(bal.value.replace(/[£,]/g, ""));
            if (!Number.isNaN(n)) asset.valuePence = Math.round(n * 100);
          }
          asset.state = "confirmed";
          asset.firmStatus = "Confirmed";
          asset.clientStatus = "Confirmed";
        }
        const doc = e.documents.find((d) => d.id === x.documentId);
        if (doc) doc.state = "accepted";
        const t = e.tasks.find((y) => /check/i.test(y.title) && doc && y.title.includes(doc.name));
        if (t) {
          t.done = true;
          t.doneOn = "Today";
        }
        const client = clientParty(e);
        audit(e, s.currentStaffId, `Reviewed extracted fields from ${x.fileName} and updated assets`);
        postUpdate(e, `Your ${doc?.name ?? "document"} has been checked`, `Thank you, ${firstName(client.name)}. Nothing more needed from you on this one.`, "amber");
      });

    case "markDocChecked":
      return withEstate(state, a.estateId, (e, s) => {
        const doc = e.documents.find((d) => d.id === a.docId);
        if (!doc || doc.state !== "checking") return;
        doc.state = "accepted";
        const client = clientParty(e);
        const me = s.staff.find((m) => m.id === s.currentStaffId);
        audit(e, s.currentStaffId, `${firstName(me?.name ?? "")} marked ${doc.name} as checked`);
        for (const t of e.tasks) if (!t.done && t.title.includes(doc.name) && t.owner.kind === "firm") t.done = true;
        postUpdate(e, `Your ${doc.name} has been checked`, `Thank you, ${firstName(client.name)}. Nothing more needed from you on this one.`, "amber");
      });

    case "uploadDocument":
      return withEstate(state, a.estateId, (e) => {
        const client = clientParty(e);
        let doc = a.docId ? e.documents.find((d) => d.id === a.docId) : undefined;
        if (!doc) {
          doc = { id: uid("d"), name: a.name, icon: "file", state: "checking" };
          e.documents.push(doc);
        }
        doc.state = "checking";
        doc.fileName = a.fileName;
        doc.uploadedBy = client.id;
        doc.uploadedAt = `Today ${timeNow()}`;
        for (const t of e.tasks) {
          if (!t.done && t.owner.kind === "family" && (t.title.toLowerCase().includes(doc.name.toLowerCase()) || doc.name.toLowerCase().includes(t.title.toLowerCase().replace(/^find /, "")))) {
            t.done = true;
            t.doneOn = "Today";
          }
        }
        e.tasks.unshift({ id: uid("t"), title: `Check ${doc.name} from ${firstName(client.name)}`, owner: { kind: "firm", staffId: e.feeEarnerId }, due: "Today", done: false });
        audit(e, client.id, `${firstName(client.name)} uploaded ${a.fileName}`);
      });

    case "addAsset":
      return withEstate(state, a.estateId, (e, s) => {
        const st = ASSET_STATUS[a.by];
        const sol = firstName(feeEarner(s, e).name);
        const asset: Asset = {
          id: uid("a"),
          kind: a.kind,
          name: a.name,
          clientName: a.name,
          institution: a.institution,
          state: a.by === "firm" ? "confirmed" : "estimate",
          firmStatus: st.firm,
          clientStatus: a.by === "family" ? `${sol} will confirm` : st.client,
          valuePence: a.valuePence,
          liability: a.liability,
          addedBy: a.by,
        };
        e.assets.push(asset);
        const who = a.by === "family" ? clientParty(e) : undefined;
        audit(e, who?.id ?? s.currentStaffId, `${who ? firstName(who.name) : "Firm"} added ${a.liability ? "liability" : "asset"}: ${a.name}${a.institution ? ` (${a.institution})` : ""}`);
        if (a.by === "family" && (a.kind === "bank" || a.kind === "savings")) {
          e.tasks.unshift({ id: uid("t"), title: `Write to ${a.institution || a.name} for date-of-death balance`, owner: { kind: "firm", staffId: e.feeEarnerId }, due: "This week", done: false });
        }
      });

    case "sendMessage":
      return withEstate(state, a.estateId, (e, s) => {
        const day = new Date().toLocaleDateString("en-GB", { weekday: "long" });
        const authorId = a.from === "client" ? e.clientPartyId : s.currentStaffId;
        e.messages.push({ id: uid("msg"), from: a.from, authorId, day, at: timeNow(), text: a.text, attachment: a.attachment });
      });

    case "addNote":
      return withEstate(state, a.estateId, (e, s) => {
        e.notes.unshift({ id: uid("n"), text: a.text, author: s.currentStaffId, at: today() });
      });

    case "createEstate": {
      const next = structuredClone(state);
      const [first] = a.deceasedName.trim().split(/\s+/);
      const parts = a.clientName.trim().split(/\s+/);
      const clientId = `p_${a.id}_client`;
      const est: Estate = {
        id: a.id,
        ref: `HRT-${String(431 + next.estates.length).padStart(4, "0")}`,
        deceased: { firstName: first, fullName: a.deceasedName.trim(), shortName: a.deceasedName.trim(), dateOfDeath: "" },
        stage: 0 as StageIndex,
        daysOpen: 0,
        feeEarnerId: a.feeEarnerId,
        clientPartyId: clientId,
        waitingOn: "family",
        blocker: `Onboarding · invitation sent to ${parts[0]}`,
        attention: false,
        funeralEstimatePence: 0,
        parties: [
          { id: clientId, name: a.clientName.trim(), initials: ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase(), role: "executor", email: a.clientEmail, color: "#E3A13A", portalStatus: "invited" },
        ],
        tasks: [
          { id: uid("t"), title: "Welcome call with the executor", owner: { kind: "firm", staffId: a.feeEarnerId }, due: "This week", done: false },
          { id: uid("t"), title: "Accept portal invitation", owner: { kind: "family", partyId: clientId }, due: "This week", done: false },
        ],
        assets: [],
        documents: [
          { id: uid("d"), name: "Death certificate", hint: "A photo of the certificate is fine", icon: "certificate", state: "needed" },
          { id: uid("d"), name: "The will", hint: "Or tell us where it's kept", icon: "scroll", state: "needed" },
        ],
        audit: [],
        notes: [],
        drafts: [],
        extractions: [],
        missing: [],
        messages: [],
        updates: [],
      };
      audit(est, next.currentStaffId, `Estate opened. Portal invitation sent to ${a.clientEmail}`);
      next.estates.push(est);
      return next;
    }

    case "completeOnboarding": {
      const next = structuredClone(state);
      next.onboarded = true;
      const e = next.estates.find((x) => x.id === next.currentClientEstateId);
      if (e) {
        const client = clientParty(e);
        audit(e, client.id, `${firstName(client.name)} completed portal setup (relationship: ${a.relationship.toLowerCase()})`);
      }
      return next;
    }
  }
}

interface StoreValue {
  state: DemoState;
  dispatch: (a: Action) => void;
  ready: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, freshSeed);
  const [ready, setReady] = useState(false);
  const skipSave = useRef(true);

  // Load saved demo state after mount (avoids hydration mismatches).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === SEED_VERSION) dispatch({ type: "hydrate", state: parsed });
      }
    } catch {
      /* storage unavailable: run from seed */
    }
    setReady(true);
  }, []);

  // Persist, and pick up changes made in other tabs.
  useEffect(() => {
    if (!ready) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready]);

  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY || !ev.newValue) return;
      try {
        const parsed = JSON.parse(ev.newValue) as DemoState;
        if (parsed.version === SEED_VERSION) {
          skipSave.current = true;
          dispatch({ type: "hydrate", state: parsed });
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ state, dispatch, ready }), [state, ready]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}

export function useDemo() {
  return useStore().state;
}

export function useEstate(id: string | undefined): Estate | undefined {
  const { state } = useStore();
  return state.estates.find((e) => e.id === id);
}

/** The estate the signed-in client (Sarah) belongs to. */
export function useClientEstate(): Estate {
  const { state } = useStore();
  return state.estates.find((e) => e.id === state.currentClientEstateId) ?? state.estates[0];
}

export function useActions() {
  const { dispatch } = useStore();
  const act = useCallback(dispatch, [dispatch]);
  return useMemo(
    () => ({
      reset: () => {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* ignore */
        }
        act({ type: "reset" });
      },
      toggleTask: (estateId: string, taskId: string) => act({ type: "toggleTask", estateId, taskId }),
      addTask: (estateId: string, title: string, owner: TaskOwner, due = "This week") => act({ type: "addTask", estateId, title, owner, due }),
      editDraft: (estateId: string, draftId: string, body: string[]) => act({ type: "editDraft", estateId, draftId, body }),
      approveDraft: (estateId: string, draftId: string) => act({ type: "approveDraft", estateId, draftId }),
      discardDraft: (estateId: string, draftId: string) => act({ type: "discardDraft", estateId, draftId }),
      resolveMissing: (estateId: string, missingId: string) => act({ type: "resolveMissing", estateId, missingId }),
      acceptExtraction: (estateId: string, extractionId: string) => act({ type: "acceptExtraction", estateId, extractionId }),
      markDocChecked: (estateId: string, docId: string) => act({ type: "markDocChecked", estateId, docId }),
      uploadDocument: (estateId: string, name: string, fileName: string, docId?: string) => act({ type: "uploadDocument", estateId, name, fileName, docId }),
      addAsset: (estateId: string, by: "firm" | "family", asset: { kind: AssetKind; name: string; institution: string; valuePence: number | null; liability: boolean }) =>
        act({ type: "addAsset", estateId, by, ...asset }),
      sendMessage: (estateId: string, from: "client" | "firm", text: string, attachment?: string) => act({ type: "sendMessage", estateId, from, text, attachment }),
      addNote: (estateId: string, text: string) => act({ type: "addNote", estateId, text }),
      createEstate: (input: { deceasedName: string; clientName: string; clientEmail: string; feeEarnerId: string }) => {
        const id = uid("est");
        act({ type: "createEstate", id, ...input });
        return id;
      },
      completeOnboarding: (input: { deceasedName: string; relationship: string }) => act({ type: "completeOnboarding", ...input }),
    }),
    [act],
  );
}
