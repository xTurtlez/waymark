"use client";

import { useState } from "react";
import { btn, input } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth-client";

export function TwoFactorForm({ next }: { next?: string }) {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = backup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: false })
      : await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, ""), trustDevice: false });
    setBusy(false);
    if (res.error) setMsg(backup ? "That backup code isn't valid." : "That code didn't work. Codes change every 30 seconds; try the latest one.");
    else window.location.href = dest;
  }

  return (
    <form onSubmit={submit} className="animate-rise rounded-[28px] border border-line bg-paper p-7" noValidate>
      <h1 className="m-0 font-serif text-[30px] font-normal leading-tight">{backup ? "Use a backup code" : "Enter your code"}</h1>
      <p className="m-0 mt-2 text-[15px] leading-relaxed text-ink-3">
        {backup ? "Enter one of the backup codes you saved when you set up two-step sign-in." : "Open your authenticator app and enter the 6-digit code for Waymark."}
      </p>
      {msg && (
        <p role="alert" className="m-0 mt-4 rounded-[14px] bg-coral-tint px-4 py-3 text-sm text-coral-ink">
          {msg}
        </p>
      )}
      <label htmlFor="code" className="mt-5 block text-[15px] font-semibold">
        {backup ? "Backup code" : "6-digit code"}
      </label>
      <input
        id="code"
        className={`${input} mt-2 text-center font-mono text-xl tracking-[0.3em]`}
        inputMode={backup ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button type="submit" disabled={busy || code.trim().length < 6} className={`${btn.primaryLg} mt-4 w-full`}>
        {busy ? "Checking…" : "Continue"}
      </button>
      <button type="button" onClick={() => setBackup((b) => !b)} className="mt-3 w-full text-sm font-semibold text-teal hover:underline">
        {backup ? "Use my authenticator app instead" : "I can't use my authenticator app"}
      </button>
    </form>
  );
}
