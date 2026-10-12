"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  PiChatCircle,
  PiChatCircleFill,
  PiClockCounterClockwise,
  PiClockCounterClockwiseFill,
  PiFolderSimple,
  PiFolderSimpleFill,
  PiPath,
  PiPathFill,
  PiWallet,
  PiWalletFill,
} from "react-icons/pi";
import { Cairn } from "@/components/brand/Cairn";
import { clientParty } from "@/lib/selectors";
import { useClientEstate, useDemo, useStore } from "@/lib/store";

const NAV: { href: string; label: string; icon: IconType; active: IconType }[] = [
  { href: "/portal", label: "Journey", icon: PiPath, active: PiPathFill },
  { href: "/portal/documents", label: "Documents", icon: PiFolderSimple, active: PiFolderSimpleFill },
  { href: "/portal/assets", label: "Assets", icon: PiWallet, active: PiWalletFill },
  { href: "/portal/messages", label: "Messages", icon: PiChatCircle, active: PiChatCircleFill },
  { href: "/portal/updates", label: "Updates", icon: PiClockCounterClockwise, active: PiClockCounterClockwiseFill },
];

/** Mobile-first column. On wider screens it sits centred like an app. */
export function PortalShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#EEE6D9]">
      <div className="relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-cream sm:shadow-[0_0_60px_-20px_rgba(43,33,28,.25)]">{children}</div>
    </div>
  );
}

export function BottomNav() {
  const pathname = usePathname().replace(/(.)\/$/, "$1");
  const estate = useClientEstate();
  const unreadUpdates = estate.updates.filter((u) => u.when === "Today").length;
  return (
    <nav aria-label="Portal" className="sticky bottom-0 z-20 mt-auto grid grid-cols-5 border-t border-line bg-paper px-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-2.5">
      {NAV.map((n) => {
        const on = n.href === "/portal" ? pathname === "/portal" || pathname === "/portal/step" : pathname.startsWith(n.href);
        const Icon = on ? n.active : n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`relative flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[12px] text-[11.5px] font-semibold no-underline ${on ? "text-teal" : "text-muted hover:text-ink"}`}
          >
            <Icon aria-hidden className="text-2xl" />
            {n.label}
            {n.label === "Updates" && unreadUpdates > 0 && !on && <span className="absolute right-[calc(50%-18px)] top-1.5 size-2 rounded-full bg-coral" aria-label="New" />}
          </Link>
        );
      })}
    </nav>
  );
}

/** Firm-branded header row: "Waymark with Ellis & Rowe" + the client's initials. */
export function PortalBrand({ className = "" }: { className?: string }) {
  const state = useDemo();
  const estate = useClientEstate();
  const me = clientParty(estate);
  const { mode } = useStore();
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <Link href="/portal" className="flex items-center gap-2 font-serif text-xl font-semibold tracking-[-0.01em] text-ink no-underline">
        <Cairn size={26} />
        Waymark
        <span className="ml-0.5 font-sans text-[13px] font-medium text-ink-3">with {state.firm.shortName}</span>
      </Link>
      <Link href={mode === "demo" ? "/" : "/account"} aria-label={`Signed in as ${me.name}. ${mode === "demo" ? "Demo home" : "Account and sign out"}`} className="grid size-11 place-items-center rounded-full bg-paper text-[15px] font-semibold text-plum no-underline">
        {me.initials}
      </Link>
    </div>
  );
}

export function PortalPage({ children, nav = true }: { children: ReactNode; nav?: boolean }) {
  return (
    <>
      <main className="flex-1 px-5 pb-8 pt-5">
        <PortalBrand className="mb-6" />
        {children}
      </main>
      {nav && <BottomNav />}
    </>
  );
}
