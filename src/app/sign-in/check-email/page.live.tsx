import type { Metadata } from "next";
import Link from "next/link";
import { PiEnvelopeSimpleOpen } from "react-icons/pi";
import { AuthFrame } from "@/components/auth/AuthFrame";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmail({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthFrame>
      <div className="animate-rise rounded-[28px] border border-line bg-paper p-7">
        <span className="grid size-14 place-items-center rounded-full bg-teal-tint text-[28px] text-teal">
          <PiEnvelopeSimpleOpen aria-hidden />
        </span>
        <h1 className="m-0 mt-5 font-serif text-[30px] font-normal leading-tight">Check your email</h1>
        <p className="m-0 mt-3 text-base leading-relaxed text-ink-2">
          If {email ? <b>{email}</b> : "that address"} is linked to an estate, we&apos;ve sent a link to sign in. It works once and lasts 15 minutes.
        </p>
        <p className="m-0 mt-3 text-[15px] leading-relaxed text-ink-3">Nothing there after a few minutes? Check your junk folder, or ask your solicitor which email address they have for you.</p>
        <Link href="/sign-in?as=family" className="mt-5 inline-block text-[15px] font-semibold text-teal">
          Try a different address
        </Link>
      </div>
    </AuthFrame>
  );
}
