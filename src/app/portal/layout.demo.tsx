import type { Metadata, Viewport } from "next";
import { PortalShell } from "@/components/portal/PortalShell";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Your estate",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF6EE",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider mode="demo">
      <PortalShell>{children}</PortalShell>
    </StoreProvider>
  );
}
