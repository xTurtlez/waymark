"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PiArrowRightBold } from "react-icons/pi";
import { Field, Sheet } from "@/components/ui/Sheet";
import { btn, input } from "@/components/ui/primitives";
import { useActions, useDemo } from "@/lib/store";

export function NewEstateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useDemo();
  const { createEstate } = useActions();
  const router = useRouter();
  const [deceasedName, setDeceased] = useState("");
  const [clientName, setClient] = useState("");
  const [clientEmail, setEmail] = useState("");
  const [feeEarnerId, setEarner] = useState(state.currentStaffId);
  const [tried, setTried] = useState(false);

  const errors = {
    deceasedName: deceasedName.trim().length < 3 ? "Enter the full name of the person who has died" : "",
    clientName: clientName.trim().length < 3 ? "Enter the executor's name" : "",
    clientEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim()) ? "" : "Enter an email address like name@example.com",
  };
  const valid = !errors.deceasedName && !errors.clientName && !errors.clientEmail;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!valid) return;
    const id = createEstate({ deceasedName, clientName, clientEmail, feeEarnerId });
    onClose();
    setDeceased("");
    setClient("");
    setEmail("");
    setTried(false);
    router.push(`/practice/estate?id=${id}`);
  }

  return (
    <Sheet open={open} onClose={onClose} title="New estate" wide>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <p className="m-0 text-[15px] leading-relaxed text-ink-3">
          We&apos;ll open the matter at stage 1 and email the executor an invitation to your firm&apos;s portal.
        </p>
        <Field label="Person who has died" error={tried ? errors.deceasedName : ""}>
          <input className={input} value={deceasedName} onChange={(e) => setDeceased(e.target.value)} placeholder="Full name as on the death certificate" autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Executor" error={tried ? errors.clientName : ""}>
            <input className={input} value={clientName} onChange={(e) => setClient(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Executor's email" error={tried ? errors.clientEmail : ""}>
            <input className={input} type="email" value={clientEmail} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        <Field label="Fee earner">
          <select className={input} value={feeEarnerId} onChange={(e) => setEarner(e.target.value)}>
            {state.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.role}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className={`${btn.primaryLg} mt-2`}>
          Open estate and invite <PiArrowRightBold aria-hidden />
        </button>
      </form>
    </Sheet>
  );
}
