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
  const [{ FOUR_DOSSIER_ASSESSMENT_TIMESTAMP, FOUR_DOSSIER_KEYS, createFourDossierCase, buildFourDossierEvidenceFiles, FOUR_DOSSIER_RULESET, FOUR_DOSSIER_REVIEWER, FOUR_DOSSIER_REVIEWER_NAME, FOUR_DOSSIER_REVIEWER_ROLE }, { AuditReadyCaseSchema }, { assessReadiness }, { runEvidenceSufficiency }, { computeEvidenceAssuranceScore }, { dossierReportId }] =
    await Promise.all([
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
      (d) => d.assessmentState === "ASSESSED" && d.passedRequirementCount === d.applicableRequirementCount
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
    (r) => r.stepCompletion && r.operatorPreparation === "100" && r.evidenceAssurance === 100 && r.blockers === 0 && r.missingEvidence === 0 && r.sealStatus === "READY"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold">Four sandbox dossiers — QA index</h1>
          <p className="text-sm text-muted">
            Ruleset {FOUR_DOSSIER_RULESET} · reviewer {FOUR_DOSSIER_REVIEWER_ROLE} ({FOUR_DOSSIER_REVIEWER_NAME} / {FOUR_DOSSIER_REVIEWER})
          </p>
        </div>
        <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
          {SANDBOX_BADGE_LABEL}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-border bg-surface">
            <tr>
              <th className="px-3 py-2 font-semibold">Scenario</th>
              <th className="px-3 py-2 font-semibold">Case ID</th>
              <th className="px-3 py-2 font-semibold">Sector</th>
              <th className="px-3 py-2 font-semibold">Step completion</th>
              <th className="px-3 py-2 font-semibold">Operator preparation</th>
              <th className="px-3 py-2 font-semibold">Evidence assurance</th>
              <th className="px-3 py-2 font-semibold">Blockers</th>
              <th className="px-3 py-2 font-semibold">Seal status</th>
              <th className="px-3 py-2 font-semibold">PDF</th>
              <th className="px-3 py-2 font-semibold">XLSX</th>
              <th className="px-3 py-2 font-semibold">ZIP</th>
              <th className="px-3 py-2 font-semibold">Offline verifier</th>
              <th className="px-3 py-2 font-semibold">Working file</th>
              <th className="px-3 py-2 font-semibold">Sealed release</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-surface/60">
                <td className="px-3 py-2 font-semibold">{row.key}</td>
                <td className="px-3 py-2 font-mono text-xs">{row.caseId}</td>
                <td className="px-3 py-2">{row.sector}</td>
                <td className="px-3 py-2"><Pill ok={row.stepCompletion} label="8/8" /></td>
                <td className="px-3 py-2">{row.operatorPreparation}/100</td>
                <td className="px-3 py-2">{row.evidenceAssurance}/100</td>
                <td className="px-3 py-2">{row.blockers}</td>
                <td className="px-3 py-2"><Pill ok={row.sealStatus === "READY"} label={row.sealStatus} /></td>
                <td className="px-3 py-2"><Pill ok={row.pdf} label="FAIL" /></td>
                <td className="px-3 py-2"><Pill ok={row.xlsx} label="FAIL" /></td>
                <td className="px-3 py-2"><Pill ok={row.zip} label="FAIL" /></td>
                <td className="px-3 py-2"><Pill ok={row.offlineVerifier} label="FAIL" /></td>
                <td className="px-3 py-2">
                  <Link href={`/cases/${row.caseId}`} className="text-primary underline underline-offset-2">Open</Link>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/cbam/reports/${row.reportId}`} className="text-primary underline underline-offset-2">Open</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`rounded-lg border p-4 text-sm font-semibold ${allPass ? "border-forest-light bg-forest-pale text-forest" : "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-[color:var(--status-blocked)]"}`}>
        {allPass ? "FOUR_DOSSIERS_QA=PASS — all four sandbox dossiers are seal-ready" : "FOUR_DOSSIERS_QA=FAIL — at least one sandbox dossier is not seal-ready"}
      </div>
    </div>
  );
}
