import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/PortalShell";
import { StoreProvider } from "@/lib/store";
import { withTenant } from "@/db/client";
import { applyAction } from "@/server/actions";
import { loadState } from "@/server/state";
import { getViewer, tenantOf } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Your estate",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF6EE",
};

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?as=family");
  if (viewer.kind === "staff") redirect("/practice");
  if (viewer.kind !== "family") redirect("/sign-in?error=no-access");

  const state = await withTenant(tenantOf(viewer), (tx) => loadState(tx, viewer));
  return (
    <StoreProvider mode="live" initial={state} apply={applyAction}>
      <PortalShell>{children}</PortalShell>
    </StoreProvider>
  );
}
