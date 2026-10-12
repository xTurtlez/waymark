import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PracticeShell } from "@/components/practice/PracticeShell";
import { StoreProvider } from "@/lib/store";
import { withTenant } from "@/db/client";
import { applyAction } from "@/server/actions";
import { env } from "@/server/env";
import { loadState } from "@/server/state";
import { getViewer, tenantOf } from "@/server/viewer";

export const metadata: Metadata = {
  title: "Practice",
};

export default async function PracticeLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.kind === "family") redirect("/portal");
  if (viewer.kind !== "staff") redirect("/sign-in?error=no-access");

  const unprotected = !viewer.mfa.totp && viewer.mfa.passkeys === 0;
  if (unprotected && env().REQUIRE_STAFF_MFA === "1") redirect("/account?setup=1");

  const state = await withTenant(tenantOf(viewer), (tx) => loadState(tx, viewer));
  return (
    <StoreProvider mode="live" initial={state} apply={applyAction}>
      {unprotected && (
        <div className="bg-coral-tint px-4 py-2.5 text-center text-sm font-medium text-coral-ink">
          Protect your account: add a passkey or an authenticator app.{" "}
          <Link href="/account" className="font-semibold underline underline-offset-4">
            Set it up
          </Link>
        </div>
      )}
      <PracticeShell>{children}</PracticeShell>
    </StoreProvider>
  );
}
