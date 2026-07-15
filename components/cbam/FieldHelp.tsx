import { CircleHelp } from "lucide-react";
import { fieldHelpData, type FieldHelpKey } from "@/lib/cbam/field-help";

interface FieldHelpProps {
  field: FieldHelpKey;
  label: string;
}

export function FieldHelp({ field, label }: FieldHelpProps) {
  const help = fieldHelpData[field];

  return (
    <details className="group relative inline-block">
      <summary
        aria-label={`Open data-source help for ${label}`}
        className="flex cursor-pointer list-none items-center rounded text-muted outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden"
      >
        <CircleHelp aria-hidden="true" className="h-4 w-4" />
      </summary>
      <div
        role="note"
        className="absolute left-0 z-[60] mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-lg border border-border bg-surface p-4 text-left text-xs font-normal leading-relaxed text-foreground shadow-xl sm:left-auto sm:right-0"
      >
        <p className="font-bold">Where to obtain it</p>
        <p className="mt-1 text-muted">{help.source}</p>
        <p className="mt-3 font-bold">Evidence to retain</p>
        <p className="mt-1 text-muted">{help.evidence}</p>
        <p className="mt-3 font-bold">Entry format</p>
        <p className="mt-1 text-muted">{help.format}</p>
      </div>
    </details>
  );
}
