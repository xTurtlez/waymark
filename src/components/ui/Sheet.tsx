"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { PiXBold } from "react-icons/pi";

/**
 * Accessible modal. Renders as a bottom sheet on small screens (portal) and a
 * centred dialog on larger ones. Closes on Escape and backdrop click, traps
 * initial focus and restores it on close.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])");
      (first ?? panel.current)?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-ink/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={`relative max-h-[92vh] w-full animate-rise overflow-y-auto rounded-t-[28px] bg-paper p-6 pb-8 shadow-sheet sm:rounded-[28px] ${wide ? "sm:max-w-[560px]" : "sm:max-w-[440px]"}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="m-0 font-serif text-[26px] font-normal leading-tight">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 flex-none place-items-center rounded-full bg-line-soft text-ink hover:bg-line"
          >
            <PiXBold />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Label + control + hint/error. The error is linked with aria-describedby
 * (not inside the label) so screen readers announce the field name cleanly.
 */
export function Field({ label, children, hint, error, prefix }: { label: string; children: ReactElement<Record<string, unknown>>; hint?: string; error?: string; prefix?: string }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error || hint;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": note ? noteId : undefined,
      })
    : children;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-semibold">
        {label}
      </label>
      {prefix ? (
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
            {prefix}
          </span>
          {control}
        </div>
      ) : (
        control
      )}
      {note && (
        <span id={noteId} className={`text-sm ${error ? "text-coral-ink" : "text-muted"}`}>
          {note}
        </span>
      )}
    </div>
  );
}
