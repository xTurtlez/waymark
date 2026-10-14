import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no request to Google at build or run time).
import "@fontsource-variable/newsreader/opsz.css";
import "@fontsource-variable/figtree/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Waymark", template: "%s · Waymark" },
  description: "Probate software for law firms in England & Wales. Waymark is not a law firm and does not give legal advice.",
};

export const viewport: Viewport = {
  themeColor: "#FBF6EE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
