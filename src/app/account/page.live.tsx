import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountSecurity } from "@/components/auth/AccountSecurity";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "Account and security" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const { setup } = await searchParams;
  const back = viewer.kind === "staff" ? "/practice" : "/portal";
  return (
    <AuthFrame wide>
      <Link href={back} className="text-sm font-semibold text-teal no-underline hover:underline">
        ← Back
      </Link>
      <h1 className="m-0 mt-3 font-serif text-[34px] font-normal leading-tight">Account and security</h1>
      <p className="m-0 mt-2 text-[15px] text-ink-3">
        Signed in as <b>{viewer.name}</b> ({viewer.email})
      </p>
      {setup && <p className="m-0 mt-4 rounded-[14px] bg-amber-tint px-4 py-3 text-sm text-amber-ink">Your firm asks staff to add a passkey or authenticator app before continuing.</p>}
      <div className="mt-6">
        <AccountSecurity totpEnabled={viewer.kind === "staff" && viewer.mfa.totp} isStaff={viewer.kind === "staff"} />
      </div>
      <Link href="/sign-out" className="mt-8 inline-block text-[15px] font-semibold text-coral-ink">
        Sign out
      </Link>
    </AuthFrame>
  );
}
