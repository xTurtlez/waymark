import type { Metadata } from "next";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { TwoFactorForm } from "@/components/auth/TwoFactorForm";

export const metadata: Metadata = { title: "Two-step sign-in" };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthFrame>
      <TwoFactorForm next={next} />
    </AuthFrame>
  );
}
