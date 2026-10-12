"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import type { AssetKind, DemoState, Estate, TaskOwner } from "./types";
import { SEED_VERSION, freshSeed } from "./seed";
import { uid } from "./format";
import { reducer, type Action } from "./reducer";

export type { Action } from "./reducer";

/**
 * Shared store for both sides of the product.
 *
 * - **demo** (GitHub Pages build): the reducer runs in the browser; state is
 *   seeded, persisted to localStorage and synced across tabs.
 * - **live**: the server renders the initial state from Postgres (scoped by
 *   row-level security). Each action is applied optimistically here and sent
 *   to a server action, which re-checks permissions, persists the change,
 *   writes the audit log and returns the authoritative state.
 */

const STORAGE_KEY = "waymark-demo";

export type StoreMode = "demo" | "live";

/** Server action signature passed down from live layouts. */
export type ApplyAction = (action: Action) => Promise<{ ok: true; state: DemoState } | { ok: false; error: string; state?: DemoState }>;

export interface UploadedFile {
  fileName: string;
  fileId?: string;
}

interface StoreValue {
  state: DemoState;
  dispatch: (a: Action) => void;
  ready: boolean;
  mode: StoreMode;
  pending: boolean;
  error: string | null;
  clearError: () => void;
  /** Store the file (live) or just record its name (demo). */
  uploadFile: (file: File, meta: { estateId: string; documentKey?: string }) => Promise<UploadedFile>;
}

const StoreContext = createContext<StoreValue | null>(null);

type Internal = { type: "__replace"; state: DemoState } | Action;

function internalReducer(state: DemoState, a: Internal): DemoState {
  if (a.type === "__replace") return a.state;
  return reducer(state, a);
}

export function StoreProvider({
  children,
  mode = "demo",
  initial,
  apply,
}: {
  children: React.ReactNode;
  mode?: StoreMode;
  initial?: DemoState;
  apply?: ApplyAction;
}) {
  const [state, rawDispatch] = useReducer(internalReducer, initial, (i) => i ?? freshSeed());
  const [ready, setReady] = useState(mode === "live");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const skipSave = useRef(true);
  const latest = useRef(state);
  latest.current = state;

  // Live: when the server sends a new initial state (navigation / refresh), adopt it.
  useEffect(() => {
    if (mode === "live" && initial) rawDispatch({ type: "__replace", state: initial });
  }, [mode, initial]);

  // Demo: load saved state after mount (avoids hydration mismatches).
  useEffect(() => {
    if (mode !== "demo") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState;
        if (parsed.version === SEED_VERSION) rawDispatch({ type: "__replace", state: parsed });
      }
    } catch {
      /* storage unavailable: run from seed */
    }
    setReady(true);
  }, [mode]);

  // Demo: persist, and pick up changes made in other tabs.
  useEffect(() => {
    if (mode !== "demo" || !ready) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready, mode]);

  useEffect(() => {
    if (mode !== "demo") return;
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== STORAGE_KEY || !ev.newValue) return;
      try {
        const parsed = JSON.parse(ev.newValue) as DemoState;
        if (parsed.version === SEED_VERSION) {
          skipSave.current = true;
          rawDispatch({ type: "__replace", state: parsed });
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mode]);

  const dispatch = useCallback(
    (a: Action) => {
      if (mode === "demo" || !apply) {
        rawDispatch(a);
        return;
      }
      if (a.type === "reset" || a.type === "hydrate") return;
      const before = latest.current;
      rawDispatch(a); // optimistic
      startTransition(async () => {
        try {
          const res = await apply(a);
          if (res.ok) rawDispatch({ type: "__replace", state: res.state });
          else {
            setError(res.error);
            rawDispatch({ type: "__replace", state: res.state ?? before });
          }
        } catch {
          setError("That didn't save. Check your connection and try again.");
          rawDispatch({ type: "__replace", state: before });
        }
      });
    },
    [mode, apply],
  );

  const uploadFile = useCallback(
    async (file: File, meta: { estateId: string; documentKey?: string }): Promise<UploadedFile> => {
      if (mode === "demo") return { fileName: file.name };
      const body = new FormData();
      body.set("file", file);
      body.set("estate", meta.estateId);
      if (meta.documentKey) body.set("documentKey", meta.documentKey);
      const res = await fetch("/api/files", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { id?: string; fileName?: string; error?: string };
      if (!res.ok || !json.id) throw new Error(json.error ?? "Upload failed. Please try again.");
      return { fileName: json.fileName ?? file.name, fileId: json.id };
    },
    [mode],
  );

  const value = useMemo(
    () => ({ state, dispatch, ready, mode, pending, error, clearError: () => setError(null), uploadFile }),
    [state, dispatch, ready, mode, pending, error, uploadFile],
  );
  return (
    <StoreContext.Provider value={value}>
      {children}
      {error && (
        <div role="alert" className="fixed inset-x-4 bottom-24 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-[16px] bg-ink px-4 py-3 text-sm text-cream shadow-lift">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold text-amber underline-offset-4 hover:underline">
            Dismiss
          </button>
        </div>
      )}
    </StoreContext.Provider>
  );
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

/** The estate the signed-in client belongs to. */
export function useClientEstate(): Estate {
  const { state } = useStore();
  return state.estates.find((e) => e.id === state.currentClientEstateId) ?? state.estates[0];
}

export function useActions() {
  const { dispatch, mode } = useStore();
  const act = dispatch;
  return useMemo(
    () => ({
      reset: () => {
        if (mode !== "demo") return;
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
    [act, mode],
  );
}
