import Link from "next/link";
import { MethodologyContent } from "@/components/methodology/MethodologyContent";

export default function WorkspaceMethodologyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent mb-2">
            Workspace reference
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Use this methodology reference while preparing a dossier. Return to the dashboard to continue your case workflow.
          </p>
          <Link
            href="/cbam"
            className="inline-flex mt-4 text-sm font-semibold text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
      <MethodologyContent />
    </div>
  );
}
