"use client";

import { Suspense } from "react";
import { EstateWorkspace } from "./Workspace";

/**
 * Estate workspace. The estate id is a query parameter (?id=ellis) rather than
 * a path segment so the app can be exported as static files (GitHub Pages).
 */
export default function EstatePage() {
  return (
    <Suspense fallback={null}>
      <EstateWorkspace />
    </Suspense>
  );
}
