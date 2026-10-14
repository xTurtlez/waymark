"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time, ticking each minute. Null during server render and hydration
 * so server and client markup match.
 */
let snapshot: Date | null = null;

function subscribe(onChange: () => void) {
  const t = window.setInterval(() => {
    snapshot = new Date();
    onChange();
  }, 60_000);
  return () => window.clearInterval(t);
}

function getSnapshot(): Date {
  if (!snapshot || Date.now() - snapshot.getTime() >= 60_000) snapshot = new Date();
  return snapshot;
}

export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

const noop = () => () => {};
/** True once the component is running in the browser after hydration. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
