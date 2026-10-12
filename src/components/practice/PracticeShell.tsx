"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  PiCheckSquare,
  PiCheckSquareFill,
  PiEnvelopeSimple,
  PiEnvelopeSimpleFill,
  PiFiles,
  PiFilesFill,
  PiFolders,
  PiFoldersFill,
  PiGear,
  PiGearFill,
  PiList,
  PiSparkle,
  PiSparkleFill,
  PiSquaresFour,
  PiSquaresFourFill,
} from "react-icons/pi";
import { Cairn } from "@/components/brand/Cairn";
import { Avatar } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/Sheet";
import { useDemo, useStore } from "@/lib/store";
import { openTaskCount, pendingDrafts, staffById } from "@/lib/selectors";

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  activeIcon: IconType;
  count?: number;
  countTone?: "amber" | "blush";
  match: (p: string) => boolean;
}

function useNav(): NavItem[] {
  const state = useDemo();
  const drafts = pendingDrafts(state).length;
  const toCheck = state.estates.reduce((n, e) => n + e.documents.filter((d) => d.state === "checking").length, 0);
  return [
    { href: "/practice", label: "Dashboard", icon: PiSquaresFour, activeIcon: PiSquaresFourFill, match: (p) => p === "/practice" },
    { href: "/practice/estates", label: "Estates", icon: PiFolders, activeIcon: PiFoldersFill, count: state.estates.length, match: (p) => p.startsWith("/practice/estate") },
    { href: "/practice/tasks", label: "Tasks", icon: PiCheckSquare, activeIcon: PiCheckSquareFill, count: openTaskCount(state), match: (p) => p.startsWith("/practice/tasks") },
    { href: "/practice/documents", label: "Documents", icon: PiFiles, activeIcon: PiFilesFill, count: toCheck || undefined, match: (p) => p.startsWith("/practice/documents") },
    { href: "/practice/letters", label: "Letters", icon: PiEnvelopeSimple, activeIcon: PiEnvelopeSimpleFill, match: (p) => p.startsWith("/practice/letters") },
    { href: "/practice/drafts", label: "AI drafts", icon: PiSparkle, activeIcon: PiSparkleFill, count: drafts || undefined, countTone: "blush", match: (p) => p.startsWith("/practice/drafts") },
    { href: "/practice/settings", label: "Settings", icon: PiGear, activeIcon: PiGearFill, match: (p) => p.startsWith("/practice/settings") },
  ];
}

function FullNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const items = useNav();
  return (
    <nav aria-label="Practice" className="flex flex-col gap-0.5">
      {items.map((n) => {
        const active = n.match(pathname);
        const Icon = active ? n.activeIcon : n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 items-center gap-3 rounded-[12px] px-3 text-[15px] font-medium no-underline transition-colors ${active ? "bg-white/10 text-cream" : "text-on-dark-2 hover:bg-white/5 hover:text-cream"}`}
          >
            <Icon aria-hidden className="text-xl" />
            <span className="flex-1">{n.label}</span>
            {n.count ? (
              <span className={`h-[22px] min-w-6 rounded-full px-[7px] text-center text-xs font-bold leading-[22px] text-ink ${n.countTone === "blush" ? "bg-blush" : "bg-amber"}`}>
                {n.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Demo: back to the demo chooser. Live: account security and sign out. */
function ShellLinks({ className, onClick }: { className: string; onClick?: () => void }) {
  const { mode } = useStore();
  if (mode === "demo")
    return (
      <Link href="/" className={className} onClick={onClick}>
        ← Demo home
      </Link>
    );
  return (
    <span className="flex flex-col gap-2">
      <Link href="/account" className={className} onClick={onClick}>
        Account and security
      </Link>
      <Link href="/sign-out" className={className} onClick={onClick}>
        Sign out
      </Link>
    </span>
  );
}

function Me() {
  const state = useDemo();
  const me = staffById(state, state.currentStaffId);
  if (!me) return null;
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-white/[0.06] p-3">
      <Avatar initials={me.initials} color={me.color} size={40} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-cream">{me.name}</div>
        <div className="text-[13px] text-on-dark-3">
          {me.role} · {state.firm.shortName}
        </div>
      </div>
    </div>
  );
}

function Rail() {
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const items = useNav().filter((n) => ["Dashboard", "Estates", "Tasks", "Letters", "AI drafts"].includes(n.label));
  return (
    <aside className="on-dark sticky top-0 hidden h-screen w-[72px] flex-none flex-col items-center gap-1.5 bg-deep-teal py-[22px] lg:flex">
      <Link href="/practice" aria-label="Waymark dashboard" className="mb-[18px]">
        <Cairn size={30} reversed />
      </Link>
      {items.map((n) => {
        const active = n.match(pathname);
        const Icon = active ? n.activeIcon : n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-label={n.label}
            title={n.label}
            aria-current={active ? "page" : undefined}
            className={`relative grid size-11 place-items-center rounded-[12px] text-[21px] transition-colors ${active ? "bg-white/10 text-cream" : "text-on-dark-2 hover:bg-white/5 hover:text-cream"}`}
          >
            <Icon aria-hidden />
            {n.count && n.label === "AI drafts" ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-blush" /> : null}
          </Link>
        );
      })}
    </aside>
  );
}

function Sidebar() {
  return (
    <aside className="on-dark sticky top-0 hidden h-screen w-[248px] flex-none flex-col gap-7 bg-deep-teal px-[18px] py-7 text-on-dark lg:flex">
      <Link href="/practice" className="flex items-center gap-2.5 px-2.5 no-underline">
        <Cairn size={28} reversed />
        <span className="font-serif text-[22px] font-medium tracking-[-0.02em] text-cream">Waymark</span>
        <span className="rounded-[6px] bg-white/[0.12] px-[7px] py-[3px] text-[11px] font-semibold tracking-[0.04em] text-cream">PRACTICE</span>
      </Link>
      <FullNav />
      <div className="mt-auto flex flex-col gap-3">
        <ShellLinks className="px-3 text-[13px] font-medium text-on-dark-3 no-underline hover:text-cream" />
        <Me />
      </div>
    </aside>
  );
}

function MobileBar() {
  const [open, setOpen] = useState(false);
  return (
    <div className="on-dark sticky top-0 z-30 flex items-center justify-between bg-deep-teal px-4 py-3 lg:hidden">
      <Link href="/practice" className="flex items-center gap-2 no-underline">
        <Cairn size={26} reversed />
        <span className="font-serif text-xl font-medium text-cream">Waymark</span>
      </Link>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-11 place-items-center rounded-[12px] text-2xl text-cream hover:bg-white/10">
        <PiList aria-hidden />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu">
        <div className="on-dark -mx-2 rounded-[20px] bg-deep-teal p-3">
          <FullNav onNavigate={() => setOpen(false)} />
        </div>
        <ShellLinks className="mt-4 inline-block text-sm font-semibold text-teal" onClick={() => setOpen(false)} />
      </Sheet>
    </div>
  );
}

export function PracticeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const compact = pathname === "/practice/estate";
  return (
    <div className="min-h-screen bg-cream lg:flex">
      {compact ? <Rail /> : <Sidebar />}
      <MobileBar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Standard page padding + header for practice pages. */
export function PracticePage({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-col gap-[26px] px-[clamp(16px,3vw,40px)] pb-11 pt-[clamp(20px,3vw,36px)]">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-[min(100%,420px)] flex-1">
          {eyebrow && <p className="m-0 text-sm font-medium text-muted">{eyebrow}</p>}
          <h1 className="m-0 mt-1 font-serif text-[clamp(28px,3vw,38px)] font-normal leading-[1.1] tracking-[-0.015em]">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      </header>
      {children}
    </main>
  );
}
