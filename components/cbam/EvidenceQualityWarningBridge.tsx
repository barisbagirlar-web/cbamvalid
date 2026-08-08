"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { EVIDENCE_QUALITY_WARNING_EVENT } from "@/lib/cbam/evidence-upload";

type EvidenceWarningDetail = {
  evidenceId?: string;
  fileName?: string;
  warnings?: string[];
};

export function EvidenceQualityWarningBridge() {
  const [detail, setDetail] = useState<EvidenceWarningDetail | null>(null);

  useEffect(() => {
    const listener = (event: Event) => {
      const custom = event as CustomEvent<EvidenceWarningDetail>;
      const warnings = Array.isArray(custom.detail?.warnings)
        ? custom.detail.warnings.filter((value) => typeof value === "string" && value.trim())
        : [];
      if (warnings.length === 0) return;
      setDetail({ ...custom.detail, warnings });
    };
    window.addEventListener(EVIDENCE_QUALITY_WARNING_EVENT, listener as EventListener);
    return () => window.removeEventListener(EVIDENCE_QUALITY_WARNING_EVENT, listener as EventListener);
  }, []);

  if (!detail?.warnings?.length) return null;

  return (
    <aside
      role="alert"
      aria-label="Evidence quality warning"
      className="fixed right-4 top-24 z-[90] w-[min(430px,calc(100vw-2rem))] rounded-xl border border-status-warning/40 bg-surface p-4 shadow-xl"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-[color:var(--status-warning-soft)] p-2 text-status-warning">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Evidence uploaded — provenance needs strengthening</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {detail.fileName ? `${detail.fileName}: ` : ""}The file is saved and hash-protected, but the following items reduce independent verifiability.
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-foreground">
            {detail.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
          </ul>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Complete structured issuer authority and external official/accreditation references where available. The warning does not fabricate a third-party signature or stamp.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDetail(null)}
          className="rounded-md p-1.5 text-muted hover:bg-neutral-soft hover:text-foreground"
          aria-label="Dismiss evidence quality warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
