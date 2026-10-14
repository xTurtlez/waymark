import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Cairn";

/** Calm, centred frame for sign-in and account pages. */
export function AuthFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[220px] -top-[160px] size-[720px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(248,205,184,.85), rgba(252,230,201,.5) 45%, rgba(251,246,238,0) 70%)" }}
      />
      <header className="relative mx-auto w-full max-w-[1080px]">
        <Link href="/" className="inline-flex no-underline" aria-label="Waymark home">
          <Wordmark size={26} markSize={32} />
        </Link>
      </header>
      <div className={`relative mx-auto my-auto w-full ${wide ? "max-w-[560px]" : "max-w-[440px]"} py-10`}>{children}</div>
      <footer className="relative mx-auto w-full max-w-[1080px] text-center text-[13px] text-muted">
        Waymark is software used by your solicitor. It is not a law firm and does not give legal advice.
      </footer>
    </main>
  );
}
