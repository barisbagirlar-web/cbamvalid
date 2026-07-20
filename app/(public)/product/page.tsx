import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import { 
  FileText, ShieldCheck, Scale, AlertTriangle, Cpu, HelpCircle, 
  ArrowRight, Download, Eye, Layers, CheckCircle2, ChevronRight 
} from "lucide-react";

export const metadata: Metadata = {
  title: "CBAMValid Product | Evidence-Linked CBAM Dossier Software",
  description: "Prepare structured CBAM cases, connect supporting evidence, resolve quality-control findings and generate sealed dossier packages.",
};

export default function ProductPage() {
  const workflowSteps = [
    { num: "01", title: "Initialize Case", desc: "Define reporting period, scope, and manufacturing installation details." },
    { num: "02", title: "Map CN Codes", desc: "Import list of goods and automatically match to official EU CBAM product categories." },
    { num: "03", title: "Upload Production Data", desc: "Enter activity levels, direct emissions, energy usage, and precursor allocations." },
    { num: "04", title: "Link Document Evidence", desc: "Attach raw invoices, utility bills, lab tests, and purchase ledger sheets." },
    { num: "05", title: "Run Quality Controls", desc: "Trigger the validation engine to scan for arithmetic gaps or missing records." },
    { num: "06", title: "Resolve Blockers", desc: "Rectify flagged compliance inconsistencies with direct system feedback." },
    { num: "07", title: "Purchase Seal Credit", desc: "Review the finalized package and purchase report credits." },
    { num: "08", title: "Export Sealed Dossier", desc: "Generate and download the cryptographically sealed integrity package containing the operator-prepared verifier-preparation dossier." }
  ];

  return (
    <div className="flex-1 bg-surface text-foreground font-sans">
      
      {/* SECTION 1: Product Overview */}
      <section className="relative py-20 overflow-hidden bg-gradient-to-b from-neutral-soft/50 to-surface">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-accent/10 text-accent uppercase tracking-wider">
              Product Overview
            </span>
            <h1 className="text-4xl md:text-5xl font-serif font-black tracking-tight leading-tight">
              Evidence-Linked CBAM Compliance Software
            </h1>
            <p className="text-muted text-lg leading-relaxed">
              CBAMValid is an enterprise platform enabling industrial exporters and EU importers to collaborate, validate, and prepare deterministic carbon emissions data for official registry declarations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link 
                href="/register?next=/cases/new" 
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-accent px-8 font-medium text-surface transition-all hover:bg-accent-hover shadow-sm"
              >
                Start a Dossier
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                href="/how-it-works" 
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-surface border border-border px-8 font-medium hover:bg-border/30 transition-colors shadow-sm"
              >
                Watch the Workflow
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-accent/5 rounded-3xl blur-3xl -z-10"></div>
            <div className="bg-surface/80 backdrop-blur-md border border-border/80 rounded-3xl p-8 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">System State</span>
                <span className="inline-flex items-center gap-1.5 text-accent text-xs font-bold bg-accent/10 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="w-4 h-4" /> Ready to Seal
                </span>
              </div>
              <div className="space-y-4">
                <div className="h-6 bg-border/20 rounded w-3/4"></div>
                <div className="h-6 bg-border/20 rounded w-1/2"></div>
                <div className="h-6 bg-border/20 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Eight-Step Case Workflow */}
      <section className="py-20 border-t border-border/50 bg-background">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-4">
            <h2 className="text-3xl font-serif font-black tracking-tight">Structured Exporter Workflow</h2>
            <p className="text-muted leading-relaxed">
              Our step-by-step case compilation maps your production operations directly to compliant EU reporting outcomes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflowSteps.map((step) => (
              <div key={step.num} className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-2xl font-black text-accent/25 font-mono block">{step.num}</span>
                <h3 className="font-bold text-lg text-foreground">{step.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3: Evidence-Linked Input Model */}
      <section className="py-20 border-t border-border/50 bg-surface">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-accent/10 text-accent uppercase tracking-wider">
              Traceability
            </span>
            <h2 className="text-3xl font-serif font-black tracking-tight">Evidence-Linked Input Model</h2>
            <p className="text-muted leading-relaxed">
              Every carbon intensity data point entered must be linked back to direct administrative or engineering records. This prevents empty declarations and ensures that importers hold auditable verification packages before submission.
            </p>
            <ul className="space-y-3 font-medium">
              <li className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                Linked utility bills, lab assays, and purchase invoices.
              </li>
              <li className="flex items-center gap-3 text-sm text-foreground">
                <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                Precursor certificates and grid allocation worksheets.
              </li>
            </ul>
          </div>
          <div className="bg-surface/80 border border-border rounded-3xl p-8 shadow-md">
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold text-muted border-b border-border/40 pb-2">
                <span>INPUT PARAMETER</span>
                <span>LINKED EVIDENCE</span>
              </div>
              <div className="flex justify-between items-center text-sm py-2 border-b border-border/20">
                <span>Electricity consumption</span>
                <span className="text-accent font-mono text-xs select-all">utility_bill_q1.pdf</span>
              </div>
              <div className="flex justify-between items-center text-sm py-2 border-b border-border/20">
                <span>CN 730890 Steel Precursors</span>
                <span className="text-accent font-mono text-xs select-all">supplier_mill_test.pdf</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Decimal-Safe Calculations */}
      <section className="py-20 border-t border-border/50 bg-background">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 bg-surface/80 border border-border rounded-3xl p-8 shadow-md">
            <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
              <span className="font-bold text-sm text-foreground">Arithmetic Precision Engine</span>
              <Cpu className="w-5 h-5 text-accent" />
            </div>
            <pre className="font-mono text-xs text-muted leading-relaxed bg-neutral-soft p-4 rounded-xl overflow-x-auto">
{`// Exact decimal math execution
const directEmissions = new Decimal("1240.239485");
const totalProduction = new Decimal("850.150000");
const intensity = directEmissions.dividedBy(totalProduction);

console.log(intensity.toFixed(6));
// Output: 1.458848`}
            </pre>
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-accent/10 text-accent uppercase tracking-wider">
              Precision
            </span>
            <h2 className="text-3xl font-serif font-black tracking-tight">Decimal-Safe Calculations</h2>
            <p className="text-muted leading-relaxed">
              Standard JavaScript binary float calculations create precision errors (e.g. 0.1 + 0.2 = 0.30000000000000004). CBAMValid runs isolated, decimal-safe calculations using Decimal.js. This provides highly precise calculation results, minimizing rounding errors when data is cross-referenced during verification.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 5: Quality Control & Blocker Model */}
      <section className="py-20 border-t border-border/50 bg-surface">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-accent/10 text-accent uppercase tracking-wider">
              Validation
            </span>
            <h2 className="text-3xl font-serif font-black tracking-tight">Quality Control & Blocker Model</h2>
            <p className="text-muted leading-relaxed">
              Our QA engine scans your CBAM case for missing files, illogical mathematical values, or gaps in your precursors. Errors are classified as **Blockers** (which prevent sealing) or **Warnings** (non-critical guidance).
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-red-500/[0.03] border border-red-500/20 rounded-2xl p-6 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-foreground text-sm">BLOCKER: Missing utility invoices</h4>
                <p className="text-muted text-xs mt-1">Electricity entries must link to a valid verification attachment to authorize report sealing.</p>
              </div>
            </div>
            <div className="bg-rose-500/[0.03] border border-rose-500/20 rounded-2xl p-6 flex gap-4">
              <HelpCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-foreground text-sm">WARNING: Outdated factor snapshot</h4>
                <p className="text-muted text-xs mt-1">You are referencing a previous methodology snapshot. Ensure this aligns with the targeted quarter.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: Calculation Trace */}
      <section className="py-20 border-t border-border/50 bg-background">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-4">
            <h2 className="text-3xl font-serif font-black tracking-tight">Full Calculation Trace</h2>
            <p className="text-muted leading-relaxed">
              Every value on your export dossiers is accompanied by a calculation trace that details the source variables, equations, and conversions.
            </p>
          </div>
          <div className="max-w-3xl mx-auto bg-surface border border-border rounded-2xl p-6 space-y-4 font-mono text-xs text-muted shadow-sm">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="font-bold text-foreground">FORMULA REGISTRY MATCH</span>
              <span className="text-accent">FORMULA_CBAM_STEEL_DIRECT_INTENSITY</span>
            </div>
            <div className="space-y-1 text-foreground font-medium">
              <p>Formula: Intensity = Direct Emissions / Production Yield</p>
              <p>Values: Intensity = 1,458.848 / 850.150</p>
              <p>Result: 1.715989 t CO2e / t steel</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: Sample Dossier */}
      <section className="py-20 border-t border-border/50 bg-surface">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-accent/10 text-accent uppercase tracking-wider">
              Transparency
            </span>
            <h2 className="text-3xl font-serif font-black tracking-tight">Review a Sample Dossier</h2>
            <p className="text-muted leading-relaxed">
              See what an operator-prepared verifier-preparation dossier looks like. Our dossier covers embedded greenhouse gas emissions reports, precursors mapping, and digital signature records.
            </p>
            <div>
              <Link 
                href="/sample-dossier" 
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-surface border border-border px-6 font-medium hover:bg-border/30 transition-colors shadow-sm"
              >
                <Eye className="w-4 h-4" /> View Sample Dossier
              </Link>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative border border-border bg-surface rounded-2xl p-6 shadow-md w-72 h-96 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-8 h-8 rounded bg-accent/10 flex items-center justify-center text-accent">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="h-4 bg-border/30 rounded w-5/6"></div>
                <div className="h-4 bg-border/30 rounded w-2/3"></div>
              </div>
              <div className="border-t border-border pt-4">
                <span className="text-[10px] font-mono text-muted uppercase">Crypto seal verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: Credits & Sealing */}
      <section className="py-20 border-t border-border/50 bg-background">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 flex justify-center">
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-md max-w-sm space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-foreground text-lg">Cryptographic Sealing</h3>
              <p className="text-muted text-xs leading-relaxed">Sealing locks the dossier, increments the transaction log, and generates public verification signatures.</p>
            </div>
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-accent/10 text-accent uppercase tracking-wider">
              Sealing
            </span>
            <h2 className="text-3xl font-serif font-black tracking-tight">Credits and Sealing</h2>
            <p className="text-muted leading-relaxed">
              Unlock finalized reports securely using account credits. 100 account credits translates exactly to 5 report seals (1 seal = 20 credits). Unlocking draft cases locks down the database records, creates a public seal record, and generates the definitive deliverables.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 9: Deliverables */}
      <section className="py-20 border-t border-border/50 bg-surface">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-4">
            <h2 className="text-3xl font-serif font-black tracking-tight">Comprehensive Deliverables</h2>
            <p className="text-muted leading-relaxed">
              Every sealed CBAMValid case generates a cryptographically sealed integrity package containing verifier-preparation assets.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm">
              <h3 className="font-bold text-foreground text-lg">1. PDF Dossier Report</h3>
              <p className="text-muted text-sm leading-relaxed">A human-readable dossier document containing emissions calculations, linked evidence tables, and digital signature logs.</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm">
              <h3 className="font-bold text-foreground text-lg">2. Structured Data Export</h3>
              <p className="text-muted text-sm leading-relaxed">O3CI field-mapped structured data export matching the reporting fields to assist import preparation.</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 shadow-sm">
              <h3 className="font-bold text-foreground text-lg">3. Cryptographic Signatures</h3>
              <p className="text-muted text-sm leading-relaxed">SHA-256 validation seal hashes recorded on the public registry ledger to allow third-party document integrity checks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 10: Verification Boundary */}
      <section className="py-20 border-t border-border/50 bg-background text-sm leading-relaxed">
        <div className="max-w-4xl mx-auto px-6 bg-surface border border-border rounded-3xl p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Mandatory Limitation & Verification Boundary</h3>
          </div>
          <p className="text-muted">
            CBAMValid prepares an operator/exporter dossier for independent verification. It does not issue an accredited independent verification opinion, customs decision, EU approval or CBAM Registry acceptance guarantee.
          </p>
        </div>
      </section>

      {/* SECTION 11: Commercial CTA */}
      <section className="py-20 border-t border-border bg-gradient-to-t from-neutral-soft/30 to-surface">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-serif font-black tracking-tight">Ready to compile compliant CBAM evidence?</h2>
          <p className="text-muted max-w-xl mx-auto leading-relaxed">
            Start preparing structured carbon emission dossiers now. Run quality checks and link support records.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link 
              href="/register?next=/cases/new" 
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-accent px-8 font-medium text-surface hover:bg-accent-hover transition-all shadow-sm"
            >
              Start a Dossier
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/pricing" 
              className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-surface border border-border px-8 font-medium hover:bg-border/30 transition-colors shadow-sm"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
