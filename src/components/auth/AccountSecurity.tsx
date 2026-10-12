"use client";

import QRCode from "qrcode";
import { useCallback, useEffect, useState } from "react";
import { PiCheckCircleFill, PiFingerprint, PiShieldCheck, PiTrash } from "react-icons/pi";
import { btn, input } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth-client";

type PasskeyRow = { id: string; name?: string | null; createdAt?: string | Date | null };

export function AccountSecurity({ totpEnabled, isStaff }: { totpEnabled: boolean; isStaff: boolean }) {
  const [totpOn, setTotpOn] = useState(totpEnabled);
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ qr: string; secret: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);

  const loadPasskeys = useCallback(async () => {
    const res = await authClient.passkey.listUserPasskeys();
    if (res.data) setPasskeys(res.data as PasskeyRow[]);
  }, []);
  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  async function startTotp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (res.error || !res.data || res.data.method !== "totp") {
      setMsg({ tone: "err", text: "That password isn't right." });
      return;
    }
    const uri = res.data.totpURI;
    const secret = new URL(uri).searchParams.get("secret") ?? "";
    setSetup({ qr: await QRCode.toDataURL(uri, { margin: 1, width: 200, color: { dark: "#2B211C", light: "#FFFDF9" } }), secret, backupCodes: res.data.backupCodes });
    setPassword("");
  }

  async function confirmTotp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
    setBusy(false);
    if (res.error) {
      setMsg({ tone: "err", text: "That code didn't work. Try the latest one from your app." });
      return;
    }
    setTotpOn(true);
    setMsg({ tone: "ok", text: "Two-step sign-in is on. Keep your backup codes somewhere safe." });
  }

  async function addPasskey() {
    setBusy(true);
    setMsg(null);
    const res = await authClient.passkey.addPasskey({ name: navigator.platform || "This device" });
    setBusy(false);
    if (res?.error) setMsg({ tone: "err", text: "The passkey wasn't added. You can try again." });
    else {
      setMsg({ tone: "ok", text: "Passkey added. You can now sign in with it." });
      await loadPasskeys();
    }
  }

  async function removePasskey(id: string) {
    await authClient.passkey.deletePasskey({ id });
    await loadPasskeys();
  }

  return (
    <div className="flex flex-col gap-5">
      {msg && (
        <p role={msg.tone === "err" ? "alert" : "status"} className={`m-0 rounded-[14px] px-4 py-3 text-sm ${msg.tone === "err" ? "bg-coral-tint text-coral-ink" : "bg-teal-tint text-teal-text"}`}>
          {msg.text}
        </p>
      )}

      <section className="rounded-[22px] border border-line bg-paper p-6">
        <h2 className="m-0 flex items-center gap-2 font-serif text-[22px] font-medium">
          <PiFingerprint aria-hidden className="text-teal" /> Passkeys
        </h2>
        <p className="m-0 mt-2 text-[15px] leading-relaxed text-ink-3">Sign in with your fingerprint, face or device PIN. Nothing to remember, and it can&apos;t be phished.</p>
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-[14px] bg-cream px-4 py-3 text-sm">
              <span className="font-semibold">{p.name || "Passkey"}</span>
              <button type="button" onClick={() => removePasskey(p.id)} aria-label={`Remove ${p.name || "passkey"}`} className="grid size-9 place-items-center rounded-full text-coral-ink hover:bg-coral-tint">
                <PiTrash aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={addPasskey} disabled={busy} className={`${btn.secondary} mt-4 h-11 text-sm`}>
          Add a passkey on this device
        </button>
      </section>

      {isStaff && (
        <section className="rounded-[22px] border border-line bg-paper p-6">
          <h2 className="m-0 flex items-center gap-2 font-serif text-[22px] font-medium">
            <PiShieldCheck aria-hidden className="text-teal" /> Authenticator app
          </h2>
          {totpOn ? (
            <p className="m-0 mt-3 flex items-center gap-2 text-[15px] font-semibold text-teal">
              <PiCheckCircleFill aria-hidden /> Two-step sign-in is on.
            </p>
          ) : setup ? (
            <form onSubmit={confirmTotp} className="mt-3 flex flex-col gap-4">
              <p className="m-0 text-[15px] leading-relaxed text-ink-3">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} className="rounded-[12px] border border-line" />
              <p className="m-0 text-sm text-muted">
                Can&apos;t scan? Enter this key: <code className="break-all font-mono text-ink">{setup.secret}</code>
              </p>
              <details className="rounded-[14px] bg-cream p-4 text-sm">
                <summary className="cursor-pointer font-semibold">Backup codes (save these now)</summary>
                <ul className="m-0 mt-3 grid list-none grid-cols-2 gap-1 p-0 font-mono">
                  {setup.backupCodes.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
              <label htmlFor="totp-code" className="text-[15px] font-semibold">
                6-digit code
              </label>
              <input id="totp-code" className={`${input} font-mono tracking-[0.3em]`} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
              <button className={`${btn.primary} h-12 text-[15px]`} disabled={busy || code.replace(/\s/g, "").length < 6}>
                Turn on two-step sign-in
              </button>
            </form>
          ) : (
            <form onSubmit={startTotp} className="mt-3 flex flex-col gap-3">
              <p className="m-0 text-[15px] leading-relaxed text-ink-3">Add a code from an app such as Microsoft Authenticator each time you sign in with your password.</p>
              <label htmlFor="pw" className="text-[15px] font-semibold">
                Confirm your password
              </label>
              <input id="pw" type="password" autoComplete="current-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className={`${btn.primary} h-12 self-start text-[15px]`} disabled={busy || !password}>
                Set up authenticator app
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
