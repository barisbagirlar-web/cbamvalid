import { CbamPassThroughCalculator } from "@/components/tools/CbamPassThroughCalculator";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";

export const metadata = generateSeoMetadata("/tools/cbam-cost-pass-through");

export default function CbamCostPassThroughPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Free negotiation tool</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">CBAM Cost Pass-Through Calculator</h1>
        <p className="mt-5 text-base leading-relaxed text-muted md:text-lg">
          Estimate how a user-defined CBAM exposure changes contract economics. The server-side engine calculates certificate cost per tonne, total EUR impact and ±20% EUA scenarios from the same normalized input, with an engine-versioned audit trail.
        </p>
        <p className="mt-3 text-sm text-muted">
          Planning model only. It does not determine official liability, issue an accredited verification opinion, replace current EU rules, or provide legal/customs advice.
        </p>
      </div>
      <div className="mt-10">
        <CbamPassThroughCalculator />
      </div>
    </main>
  );
}
