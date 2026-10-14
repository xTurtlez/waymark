"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PiArrowRightBold, PiFingerprint, PiMicrosoftOutlookLogo } from "react-icons/pi";
import { btn, input } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth-client";

type Tab = "staff" | "family";

export function SignInForm({ initialTab, initialEmail, sso, next, error }: { initialTab: Tab; initialEmail?: string; sso: boolean; next?: string; error?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(error === "no-access" ? "That account doesn't have access to an estate or firm yet. Please contact your solicitor." : null);

  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function staffSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (res.error) {
      setMsg(
        res.error.status === 429
          ? "Too many attempts. Please wait a minute, then try again."
          : "That email and password don't match. Check them and try again.",
      );
      return;
    }
    // If two-factor is on, the client plugin has already redirected.
    if (!(res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) router.push(dest);
  }

  async function passkeySignIn() {
    setBusy(true);
    setMsg(null);
    const res = await authClient.signIn.passkey();
    setBusy(false);
    if (res?.error) setMsg("We couldn't sign you in with a passkey on this device.");
    else router.push(dest);
  }

  async function familyLink(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMsg("Enter an email address like name@example.com");
      return;
    }
    setBusy(true);
    setMsg(null);
    // Same confirmation whether or not the address has an account (no account enumeration).
    await authClient.signIn.magicLink({ email: email.trim(), callbackURL: "/portal" }).catch(() => undefined);
    router.push(`/sign-in/check-email?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <div className="animate-rise rounded-[28px] border border-line bg-paper p-7 shadow-[0_40px_80px_-30px_rgba(43,33,28,.25)]">
      <h1 className="m-0 font-serif text-[32px] font-normal leading-tight tracking-[-0.015em]">Sign in</h1>
      <div role="tablist" aria-label="Who are you?" className="mt-5 grid grid-cols-2 gap-1 rounded-[14px] bg-line-soft p-1">
        {(
          [
            ["staff", "I work at a firm"],
            ["family", "Executor or family"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setMsg(null);
            }}
            className={`h-11 rounded-[10px] text-sm font-semibold ${tab === id ? "bg-paper shadow-[0_1px_3px_rgba(43,33,28,.12)]" : "text-ink-3 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <p role="alert" className="m-0 mt-4 rounded-[14px] bg-coral-tint px-4 py-3 text-sm text-coral-ink">
          {msg}
        </p>
      )}

      {tab === "staff" ? (
        <form onSubmit={staffSignIn} className="mt-5 flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-[15px] font-semibold">
              Work email
            </label>
            <input id="email" type="email" autoComplete="username webauthn" className={input} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-[15px] font-semibold">
              Password
            </label>
            <input id="password" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" disabled={busy || !email || !password} className={btn.primaryLg}>
            {busy ? "Signing in…" : "Sign in"} {!busy && <PiArrowRightBold aria-hidden />}
          </button>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={passkeySignIn} disabled={busy} className={btn.secondaryLg}>
            <PiFingerprint aria-hidden className="text-xl" /> Sign in with a passkey
          </button>
          {sso && (
            <button
              type="button"
              disabled={busy}
              onClick={() => authClient.signIn.social({ provider: "microsoft", callbackURL: dest })}
              className={btn.secondaryLg}
            >
              <PiMicrosoftOutlookLogo aria-hidden className="text-xl" /> Sign in with Microsoft
            </button>
          )}
        </form>
      ) : (
        <form onSubmit={familyLink} className="mt-5 flex flex-col gap-4" noValidate>
          <p className="m-0 text-[15px] leading-relaxed text-ink-3">We&apos;ll email you a link to sign in. No password needed.</p>
          <div className="flex flex-col gap-2">
            <label htmlFor="family-email" className="text-[15px] font-semibold">
              Your email address
            </label>
            <input id="family-email" type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <span className="text-sm text-muted">Use the address your solicitor has for you.</span>
          </div>
          <button type="submit" disabled={busy} className={btn.primaryLg}>
            {busy ? "Sending…" : "Email me a link"} {!busy && <PiArrowRightBold aria-hidden />}
          </button>
        </form>
      )}
    </div>
  );
}
