import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { SignInForm } from "@/components/auth/SignInForm";
import { env } from "@/server/env";
import { getViewer } from "@/server/viewer";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  if (viewer?.kind === "staff") redirect("/practice");
  if (viewer?.kind === "family") redirect("/portal");
  return (
    <AuthFrame>
      <SignInForm
        initialTab={sp.as === "family" ? "family" : "staff"}
        initialEmail={sp.email}
        sso={Boolean(env().MICROSOFT_CLIENT_ID)}
        next={sp.next}
        error={viewer?.kind === "none" ? "no-access" : sp.error}
      />
    </AuthFrame>
  );
}
