"use client";

import { useRef, useState } from "react";
import { PiCamera, PiCheckBold, PiPlusBold, PiUploadSimple } from "react-icons/pi";
import { PortalPage } from "@/components/portal/PortalShell";
import { DOC_ICON } from "@/components/shared/assetMeta";
import { Field, Sheet } from "@/components/ui/Sheet";
import { btn, input } from "@/components/ui/primitives";
import { feeEarner, firstName } from "@/lib/selectors";
import { useActions, useClientEstate, useDemo, useStore } from "@/lib/store";
import type { DocState } from "@/lib/types";

const CLIENT_STATUS: Record<Exclude<DocState, "needed">, { label: string; cls: string }> = {
  accepted: { label: "All good", cls: "bg-teal-tint text-teal" },
  held: { label: "All good", cls: "bg-teal-tint text-teal" },
  checking: { label: "is checking", cls: "bg-amber-tint text-amber-ink" },
};

export default function Documents() {
  const state = useDemo();
  const estate = useClientEstate();
  const { uploadDocument } = useActions();
  const solFirst = firstName(feeEarner(state, estate).name);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [targetDoc, setTargetDoc] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [choice, setChoice] = useState<string>("");
  const [otherName, setOtherName] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [thanks, setThanks] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { uploadFile } = useStore();

  const needed = estate.documents.filter((d) => d.state === "needed");
  const gathered = estate.documents.filter((d) => d.state !== "needed");
  const total = estate.documents.length;
  const pct = total ? Math.round((gathered.length / total) * 100) : 0;

  function pick(kind: "photo" | "file", docId: string | null) {
    setTargetDoc(docId);
    (kind === "photo" ? photoInput : fileInput).current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    if (targetDoc) {
      void finish(targetDoc, file, url);
    } else {
      setPending({ file, url });
      setChoice(needed[0]?.id ?? "other");
    }
  }

  async function finish(docId: string | null, file: File, url: string, name?: string) {
    const doc = docId ? estate.documents.find((d) => d.id === docId) : undefined;
    const docName = doc?.name ?? name ?? "Document";
    setUploading(true);
    setUploadError(null);
    try {
      const stored = await uploadFile(file, { estateId: estate.id });
      uploadDocument(estate.id, docName, stored.fileName, doc?.id, stored.fileId);
      if (url && doc) setThumbs((t) => ({ ...t, [doc.id]: url }));
      setPending(null);
      setTargetDoc(null);
      setOtherName("");
      setThanks(docName);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setPending(null);
      setTargetDoc(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <PortalPage>
      <h1 className="m-0 font-serif text-[32px] font-normal leading-[1.15]">Let&apos;s gather what you&apos;ll need</h1>
      <p className="m-0 mt-2 text-base leading-normal text-ink-3">Add things whenever you find them. {solFirst} checks each one.</p>
      <div className="mt-[18px] flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-line-soft" role="progressbar" aria-valuenow={gathered.length} aria-valuemin={0} aria-valuemax={total} aria-label="Documents gathered">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#0E5F5B,#E3A13A)" }} />
        </div>
        <span className="text-sm font-semibold">
          {gathered.length} of {total}
        </span>
      </div>

      {uploading && (
        <p role="status" className="m-0 mt-4 rounded-[18px] bg-paper p-4 text-[15px] text-ink-3">
          Uploading securely…
        </p>
      )}
      {uploadError && (
        <p role="alert" className="m-0 mt-4 rounded-[18px] bg-coral-tint p-4 text-[15px] text-coral-ink">
          {uploadError}
        </p>
      )}
      {thanks && !uploading && (
        <div role="status" className="mt-4 flex animate-rise items-center gap-3 rounded-[18px] bg-teal-tint p-4 text-teal-text">
          <span className="grid size-9 flex-none place-items-center rounded-full bg-teal text-white">
            <PiCheckBold aria-hidden />
          </span>
          <p className="m-0 text-[15px] leading-snug">
            <b>Thank you.</b> {solFirst} will check the {thanks.toLowerCase()} and let you know.
          </p>
        </div>
      )}

      <div className="mt-[18px] flex flex-col gap-3 rounded-[24px] border-2 border-dashed border-amber bg-amber-wash p-[18px]">
        <div className="text-base font-semibold">Add a document</div>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => pick("photo", null)} className={`${btn.primary} h-[52px] flex-1 rounded-[16px] text-base`}>
            <PiCamera aria-hidden className="text-xl" /> Take a photo
          </button>
          <button type="button" onClick={() => pick("file", null)} className="inline-flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] border-[1.5px] border-line-strong bg-paper text-base font-semibold hover:bg-cream">
            <PiUploadSimple aria-hidden className="text-xl" /> Choose file
          </button>
        </div>
        <input ref={photoInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
        <input ref={fileInput} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      </div>

      {needed.length > 0 && (
        <>
          <h2 className="m-0 mb-2.5 mt-[22px] text-[13px] font-semibold uppercase tracking-[0.06em] text-amber-ink">Still needed · {needed.length}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {needed.map((d) => {
              const Icon = DOC_ICON[d.icon];
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => pick("file", d.id)}
                    className="flex min-h-16 w-full items-center gap-3.5 rounded-[18px] border border-line bg-paper px-3.5 py-2.5 text-left hover:bg-cream"
                    aria-label={`Add ${d.name}`}
                  >
                    <Icon aria-hidden className="flex-none text-2xl text-amber-ink" />
                    <span className="flex-1">
                      <span className="block text-base font-semibold">{d.name}</span>
                      {d.hint && <span className="block text-sm text-muted">{d.hint}</span>}
                    </span>
                    <PiPlusBold aria-hidden className="text-lg text-teal" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2 className="m-0 mb-2.5 mt-[22px] text-[13px] font-semibold uppercase tracking-[0.06em] text-teal">Gathered · {gathered.length}</h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0">
        {gathered.map((d) => {
          const st = CLIENT_STATUS[d.state as Exclude<DocState, "needed">];
          const thumb = thumbs[d.id];
          return (
            <li key={d.id} className="rounded-[18px] border border-line bg-paper p-3">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-14 w-full rounded-[10px] object-cover" />
              ) : (
                <div className={`grid h-14 place-items-center rounded-[10px] font-mono text-[10px] ${d.state === "checking" ? "scan-warm text-muted" : "scan-teal text-[#3D6B66]"}`} aria-hidden>
                  scan
                </div>
              )}
              <div className="mt-2 text-sm font-semibold">{d.name}</div>
              <div className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-[9px] py-[3px] text-xs font-semibold ${st.cls}`}>
                {d.state === "checking" ? `${solFirst} ${st.label}` : st.label}
              </div>
            </li>
          );
        })}
      </ul>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="What is this?">
        {pending && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (choice === "other" && !otherName.trim()) return;
              void finish(choice === "other" ? null : choice, pending.file, pending.url, otherName.trim());
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-3 rounded-[16px] bg-cream p-3">
              {pending.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pending.url} alt="" className="size-14 rounded-[10px] object-cover" />
              ) : (
                <div className="scan-warm size-14 rounded-[10px]" aria-hidden />
              )}
              <span className="min-w-0 truncate text-sm font-semibold">{pending.file.name}</span>
            </div>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-[15px] font-semibold">Choose the closest match</legend>
              {[...needed.map((d) => ({ id: d.id, name: d.name })), { id: "other", name: "Something else" }].map((o) => (
                <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-[16px] p-4 ${choice === o.id ? "border-2 border-teal bg-paper" : "border-[1.5px] border-line-strong"}`}>
                  <input type="radio" name="doc" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} className="size-5 accent-teal" />
                  <span className="text-base font-semibold">{o.name}</span>
                </label>
              ))}
            </fieldset>
            {choice === "other" && (
              <Field label="What should we call it?">
                <input className={input} value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="For example, Premium Bonds letter" />
              </Field>
            )}
            <button type="submit" className={btn.primaryLg}>
              Send to {solFirst}
            </button>
          </form>
        )}
      </Sheet>
    </PortalPage>
  );
}
