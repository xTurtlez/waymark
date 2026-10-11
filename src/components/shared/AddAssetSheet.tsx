"use client";

import { useState } from "react";
import { PiCheckBold } from "react-icons/pi";
import { Field, Sheet } from "@/components/ui/Sheet";
import { btn, input } from "@/components/ui/primitives";
import { useActions } from "@/lib/store";
import { parseMoney } from "@/lib/format";
import type { AssetKind } from "@/lib/types";
import { ASSET_KIND_LABEL } from "./assetMeta";

/**
 * Add an asset or debt. Used by the family (plain language, guesses welcome)
 * and by the firm (ledger entry).
 */
export function AddAssetSheet({
  open,
  onClose,
  estateId,
  by,
  defaultKind = "bank",
  ownerName,
  solicitorName,
}: {
  open: boolean;
  onClose: () => void;
  estateId: string;
  by: "firm" | "family";
  defaultKind?: AssetKind;
  ownerName: string;
  solicitorName: string;
}) {
  const { addAsset } = useActions();
  const [kind, setKind] = useState<AssetKind>(defaultKind);
  const [institution, setInstitution] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [tried, setTried] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const meta = ASSET_KIND_LABEL.find((k) => k.kind === kind)!;
  const isBank = kind === "bank" || kind === "savings";
  const family = by === "family";
  const valuePence = amount.trim() ? parseMoney(amount) : null;
  const amountError = amount.trim() && valuePence === null ? "Enter an amount like 2,500 or leave it blank" : "";
  const nameError = !institution.trim() && !name.trim() ? (isBank ? "Enter the bank or building society" : "Give it a short name") : "";

  function reset() {
    setInstitution("");
    setName("");
    setAmount("");
    setTried(false);
    setDone(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (nameError || amountError) return;
    const displayName = isBank ? `${institution.trim()} ${kind === "savings" ? "savings" : "account"}` : name.trim() || institution.trim();
    addAsset(estateId, by, {
      kind,
      name: displayName,
      institution: isBank ? institution.trim() : institution.trim() || "",
      valuePence,
      liability: !!meta.liability,
    });
    setDone(displayName);
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title={done ? "Added. Thank you." : family ? `Add something ${ownerName} owned or owed` : "Add to the ledger"}>
      {done ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-[18px] bg-teal-tint p-4 text-teal-text">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-teal text-white">
              <PiCheckBold aria-hidden />
            </span>
            <p className="m-0 text-base leading-snug">
              <b>{done}</b> is on the list.{" "}
              {family ? `${solicitorName} will confirm the details${isBank ? " and write to the bank for you" : ""}.` : "Logged in the audit trail."}
            </p>
          </div>
          <button type="button" className={btn.primaryLg} onClick={reset}>
            Add another
          </button>
          <button type="button" className="h-11 text-[15px] font-semibold text-teal" onClick={close}>
            I&apos;m done for now
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2.5 text-[15px] font-semibold">What is it?</legend>
            <div className="flex flex-wrap gap-2">
              {ASSET_KIND_LABEL.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  aria-pressed={kind === k.kind}
                  onClick={() => setKind(k.kind)}
                  className={`h-11 rounded-full px-4 text-[15px] ${kind === k.kind ? "bg-teal font-semibold text-white" : "border-[1.5px] border-line-strong font-medium text-ink hover:bg-cream"}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </fieldset>
          {isBank ? (
            <Field label="Bank or building society" error={tried ? nameError : ""}>
              <input className={input} value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="For example, Lloyds" autoComplete="off" />
            </Field>
          ) : (
            <>
              <Field label="What should we call it?" error={tried ? nameError : ""}>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "property" ? "Address" : "A short description"} autoComplete="off" />
              </Field>
              <Field label={meta.liability ? "Who is it owed to?" : "Company or provider (optional)"}>
                <input className={input} value={institution} onChange={(e) => setInstitution(e.target.value)} autoComplete="off" />
              </Field>
            </>
          )}
          <Field
            label={meta.liability ? "Roughly how much is owed?" : "Roughly how much is it worth?"}
            hint={family ? "A guess is fine. Leave it blank if you have no idea." : "Value at date of death. Leave blank if TBC."}
            error={tried ? amountError : ""}
            prefix="£"
          >
            <input className={`${input} pl-8`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
          </Field>
          <button type="submit" className={btn.primaryLg}>
            Add {meta.liability ? "debt" : "it"}
          </button>
        </form>
      )}
    </Sheet>
  );
}
