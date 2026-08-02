import { notFound } from "next/navigation";
import Link from "next/link";
import { isSandboxApp, SANDBOX_BADGE_LABEL } from "@/lib/cbam/sandbox-env";

export const dynamic = "force-dynamic";

function sectorFor(key: string): string {
  switch (key) {
    case "STEEL_IN": return "Iron & steel";
    case "CEMENT_EG": return "Cement";
    case "ALU_CN": return "Aluminium";
    case "FERTILISER_TR": return "Fertilisers";
    default: return "—";
  }
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        ok ? "bg-forest-pale text-forest" : "bg-[color:var(--status-blocked-soft)] text-[color:var(--status-blocked)]"
      }`}
    >
      {ok ? "PASS" : label}
    </span>
  );
}

interface QaRow {
  key: string;
  caseId: string;
  reportId: string;
  sector: string;
  stepCompletion: boolean;
  operatorPreparation: string;
  evidenceAssurance: number;
  blockers: number;
  missingEvidence: number;
  sealStatus: string;
  pdf: boolean;
  xlsx: boolean;
  zip: boolean;
  offlineVerifier: boolean;
}

export default async function QaFourDossiersPage() {
  // Sandbox-only route: production must 404 and must never load fixture data.
  if (!isSandboxApp()) {
    notFound();
  }

  // Load fixtures and the server SSOT only after the sandbox gate, so
  // production bundles never touch synthetic dossier data.
  const [
    {
      FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
      FOUR_DOSSIER_KEYS,
      createFourDossierCase,
      buildFourDossierEvidenceFiles,
      FOUR_DOSSIER_RULESET,
      FOUR_DOSSIER_REVIEWER,
      FOUR_DOSSIER_REVIEWER_NAME,
      FOUR_DOSSIER_REVIEWER_ROLE,
    },
    { AuditReadyCaseSchema },
    { assessReadiness },
    { runEvidenceSufficiency },
    { computeEvidenceAssuranceScore },
    {
      dossierReportId,
      DOSSIER_RELEASE_VERSION,
      DOSSIER_RELEASE_CONTRACT_VERSION,
      FOUR_DOSSIER_FIXTURE_SET,
    },
  ] = await Promise.all([
    import("@/tests/fixtures/four-dossiers"),
    import("@/functions/src/cbam/schema"),
    import("@/functions/src/cbam/validation/readiness-score"),
    import("@/functions/src/cbam/validation/evidence-sufficiency"),
    import("@/functions/src/cbam/report/honest-scoreboard"),
    import("@/tests/fixtures/four-dossier-package"),
  ]);

  const rows: QaRow[] = [];
  for (const key of FOUR_DOSSIER_KEYS) {
    const caseData = createFourDossierCase(key);
    await buildFourDossierEvidenceFiles(caseData);
    const parsed = AuditReadyCaseSchema.parse(caseData);
    const readiness = assessReadiness({
      caseData: parsed,
      isDraft: false,
      assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
      sealMode: "PREVIEW",
    });
    const evidenceAssurance = computeEvidenceAssuranceScore(
      runEvidenceSufficiency(parsed, FOUR_DOSSIER_ASSESSMENT_TIMESTAMP)
    );
    const caseId = parsed.caseId ?? "";
    const sealOk = readiness.canSeal;
    const stepCompletion = readiness.dimensions.every(
      (dimension) =>
        dimension.assessmentState === "ASSESSED" &&
        dimension.passedRequirementCount === dimension.applicableRequirementCount
    );

    rows.push({
      key,
      caseId,
      reportId: dossierReportId(key),
      sector: sectorFor(key),
      stepCompletion,
      operatorPreparation: readiness.score,
      evidenceAssurance: evidenceAssurance.score,
      blockers: readiness.criticalBlockerCount,
      missingEvidence: readiness.missingMaterialEvidenceCount,
      sealStatus: sealOk ? "READY" : "BLOCKED",
      pdf: sealOk,
      xlsx: sealOk,
      zip: sealOk,
      offlineVerifier: sealOk,
    });
  }

  const allPass = rows.every(
    (row) =>
      row.stepCompletion &&
      row.operatorPreparation === "100" &&
      row.evidenceAssurance === 100 &&
      row.blockers === 0 &&
      row.missingEvidence === 0 &&
      row.sealStatus === "READY"
  );

  const processSteps = [
    "Build the complete annual sector fixture and deterministic evidence files.",
    "Run reporting-period, methodology, evidence, calculation and reconciliation gates.",
    "Generate the current V5 PDF, verifier workbook, JSON traces and 26-component package.",
    "Hash every component, create the detached sandbox signature and reopen the ZIP.",
    "Run the offline verifier and publish the current synthetic QA downloads below.",
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold">Current-engine four-sector dossier review</h1>
          <p className="mt-1 text-sm text-muted">
            Fixture set {FOUR_DOSSIER_FIXTURE_SET} · Release {DOSSIER_RELEASE_VERSION} · report contract V{DOSSIER_RELEASE_CONTRACT_VERSION}
          </p>
          <p className="text-sm text-muted">
            Ruleset {FOUR_DOSSIER_RULESET} · reviewer {FOUR_DOSSIER_REVIEWER_ROLE} ({FOUR_DOSSIER_REVIEWER_NAME} / {FOUR_DOSSIER_REVIEWER})
          </p>
        </div>
        <span className="inline-flex items-center rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-1 text-xs font-bold text-status-warning">
          {SANDBOX_BADGE_LABEL}
        </span>
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-serif text-lg font-bold">How each current package is produced</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-5">
          {processSteps.map((step, index) => (
            <li key={step} className="rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted">
              <span className="mb-2 block font-mono text-sm font-bold text-accent">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1380px] text-left text-sm">
          <thead className="border-b border-border bg-surface">
            <tr>
              <th className="px-3 py-2 font-semibold">Scenario</th>
              <th className="px-3 py-2 font-semibold">Sector</th>
              <th className="px-3 py-2 font-semibold">Case ID</th>
              <th className="px-3 py-2 font-semibold">8-step completion</th>
              <th className="px-3 py-2 font-semibold">Operator preparation</th>
              <th className="px-3 py-2 font-semibold">Evidence assurance</th>
              <th className="px-3 py-2 font-semibold">Blockers</th>
              <th className="px-3 py-2 font-semibold">Missing evidence</th>
              <th className="px-3 py-2 font-semibold">Seal status</th>
              <th className="px-3 py-2 font-semibold">Current PDF</th>
              <th className="px-3 py-2 font-semibold">Current XLSX</th>
              <th className="px-3 py-2 font-semibold">Current ZIP</th>
              <th className="px-3 py-2 font-semibold">Manifest</th>
              <th className="px-3 py-2 font-semibold">Working file</th>
              <th className="px-3 py-2 font-semibold">Stored release</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-surface/60">
                <td className="px-3 py-2 font-semibold">{row.key}</td>
                <td className="px-3 py-2">{row.sector}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.caseId}</td>
                <td className="px-3 py-2"><Pill ok={row.stepCompletion} label="INCOMPLETE" /></td>
                <td className="px-3 py-2">{row.operatorPreparation}/100</td>
                <td className="px-3 py-2">{row.evidenceAssurance}/100</td>
                <td className="px-3 py-2">{row.blockers}</td>
                <td className="px-3 py-2">{row.missingEvidence}</td>
                <td className="px-3 py-2"><Pill ok={row.sealStatus === "READY"} label={row.sealStatus} /></td>
                <td className="px-3 py-2">
                  <a href={`/api/qa/four-dossiers/${row.key}/pdf`} className="text-primary underline underline-offset-2">Download</a>
                </td>
                <td className="px-3 py-2">
                  <a href={`/api/qa/four-dossiers/${row.key}/xlsx`} className="text-primary underline underline-offset-2">Download</a>
                </td>
                <td className="px-3 py-2">
                  <a href={`/api/qa/four-dossiers/${row.key}/zip`} className="text-primary underline underline-offset-2">Download</a>
                </td>
                <td className="px-3 py-2">
                  <a href={`/api/qa/four-dossiers/${row.key}/manifest`} className="text-primary underline underline-offset-2">Download</a>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/cases/${row.caseId}?step=8`} className="text-primary underline underline-offset-2">Open step 8</Link>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/cbam/reports/${row.reportId}`} className="text-primary underline underline-offset-2">Open release</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`rounded-lg border p-4 text-sm font-semibold ${allPass ? "border-forest-light bg-forest-pale text-forest" : "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-[color:var(--status-blocked)]"}`}>
        {allPass
          ? "FOUR_DOSSIERS_QA=PASS — all four current-engine sandbox dossiers are seal-ready"
          : "FOUR_DOSSIERS_QA=FAIL — at least one current-engine sandbox dossier is not seal-ready"}
      </div>
    </div>
  );
}
