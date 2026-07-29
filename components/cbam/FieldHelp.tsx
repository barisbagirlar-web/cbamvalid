"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { fieldHelpData, type FieldHelpKey } from "@/lib/cbam/field-help";

interface FieldHelpProps {
  field: FieldHelpKey;
  label: string;
}

export function FieldHelp({ field, label }: FieldHelpProps) {
  const help = fieldHelpData[field];
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const openButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => openButton.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(
        dialog.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeys);
    };
  }, [close, open]);

  return (
    <>
      <button
        ref={openButton}
        type="button"
        aria-label={`Open data-source help for ${label}`}
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen(true)}
        className="flex items-center rounded text-muted outline-none transition hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        <CircleHelp aria-hidden="true" className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section
            ref={dialog}
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface text-left text-sm font-normal leading-relaxed text-foreground shadow-2xl"
          >
            <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Field guidance</p>
                <h2 id={titleId} className="mt-1 text-lg font-bold">{label}</h2>
              </div>
              <button
                ref={closeButton}
                type="button"
                aria-label={`Close data-source help for ${label}`}
                onClick={close}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted transition hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>

            <div className="space-y-5 px-5 py-5">
              <div>
                <h3 className="font-bold">Where to obtain it</h3>
                <p className="mt-1 text-muted">{help.source}</p>
              </div>
              <div>
                <h3 className="font-bold">Evidence to retain</h3>
                <p className="mt-1 text-muted">{help.evidence}</p>
              </div>
              <div>
                <h3 className="font-bold">Entry format</h3>
                <p className="mt-1 text-muted">{help.format}</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
