import type { Metadata, Viewport } from "next";
import { Figtree, Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal"],
  variable: "--font-newsreader",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Waymark", template: "%s · Waymark" },
  description: "Probate software for law firms in England & Wales. Waymark is not a law firm and does not give legal advice.",
};

export const viewport: Viewport = {
  themeColor: "#FBF6EE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${newsreader.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
