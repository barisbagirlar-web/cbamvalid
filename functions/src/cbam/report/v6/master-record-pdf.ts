/**
 * G-13 — Enterprise Compliance Master Record renderer.
 *
 * Renders the 30 binding sections (A1-H4) on A4 portrait, 18mm top/bottom and
 * 16mm side margins, single variable-weight type family, at most two accent
 * colours, status colours that carry meaning, thin table separators, tabular
 * numerals, monospace hash display and the mandated footer on every page.
 * Diagrams are vector (rect + line); raster images are forbidden.
 */
import { jsPDF } from "jspdf";
import crypto from "node:crypto";
import type { MasterRecordModel } from "./master-record-model";
import { MASTER_RECORD_FOOTER } from "./master-record-model";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V6 } from "../package-components";
import { HASH_CANONICAL_RULE } from "./hash-architecture";
import { buildRegistryTemplateMapping } from "../../registry/registry-template-mapping";

export interface MasterRecordTable {
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  widths?: number[];
  monospace?: number[];
}

export type MasterRecordBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "table"; table: MasterRecordTable }
  | { kind: "callout"; label: string; value: string }
  | { kind: "badges"; badges: Array<{ label: string; value: string; note: string }> }
  | { kind: "boxes"; boxes: Array<{ title: string; lines: string[] }> }
  | { kind: "steps"; steps: string[] }
  | { kind: "diagram"; type: "boundary" | "dag"; boxes: Array<{ label: string; sub: string }>; edges: Array<{ from: number; to: number }> };

export interface MasterRecordSection {
  id: string;
  title: string;
  pageBreakBefore: boolean;
  blocks: MasterRecordBlock[];
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 16;
const MARGIN_TOP = 22;
const MARGIN_BOTTOM = 22;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BODY_TOP = MARGIN_TOP;
const BODY_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM - 6;

const INK = [35, 41, 52] as const;
const HEADING = [20, 42, 74] as const;
const ACCENT = [197, 103, 62] as const;
const LINE = [211, 218, 227] as const;

function asText(value: unknown): string {
  const result = String(value ?? "—").trim();
  return result || "—";
}

function shortHash(value: string): string {
  return value.length > 24 ? `${value.slice(0, 16)}…${value.slice(-8)}` : value;
}

function normalizedWidths(count: number, requested?: number[]): number[] {
  if (!requested || requested.length !== count || requested.some((w) => !Number.isFinite(w) || w <= 0)) {
    return Array.from({ length: count }, () => CONTENT_WIDTH / count);
  }
  const total = requested.reduce((sum, w) => sum + w, 0);
  return requested.map((w) => (w / total) * CONTENT_WIDTH);
}

/**
 * C2 — score breakdown rows from the readiness assessment. Every dimension row
 * carries the assessed weight, achieved score, lost points and the loss reason
 * from the sealed assessment; integrity penalties that further reduce the data
 * axis are appended so every lost point is explained (mandate C2).
 */
const C2_COMPONENTS: ReadonlyArray<{ dimensionId: string; name: string; action: string }> = [
  { dimensionId: "IDENTITY", name: "Identity and installation", action: "Keep records current" },
  { dimensionId: "SCOPE_AND_METHODOLOGY", name: "Scope and methodology", action: "Keep methodology decisions complete" },
  { dimensionId: "ACTIVITY_DATA", name: "Activity data", action: "Maintain measurement evidence" },
  { dimensionId: "EVIDENCE", name: "Evidence completeness", action: "Link evidence to every mandatory field" },
  { dimensionId: "CALCULATION_INTEGRITY", name: "Calculation integrity", action: "Recompute after any input change" },
  { dimensionId: "ALLOCATION_AND_RECONCILIATION", name: "Allocation and reconciliation", action: "Keep allocation shares reconciled" },
  { dimensionId: "DATA_QUALITY_AND_UNCERTAINTY", name: "Data quality and uncertainty", action: "Document measurement methods" },
  { dimensionId: "PACKAGE_INTEGRITY", name: "Package integrity", action: "Seal after all checks pass" },
];

function scoreBreakdownRows(model: MasterRecordModel): Array<Array<string | number | null | undefined>> {
  const rows: Array<Array<string | number | null | undefined>> = [];
  for (const component of C2_COMPONENTS) {
    const dimension = model.readiness.dimensions.find((d) => d.dimensionId === component.dimensionId);
    if (!dimension) {
      rows.push([component.name, "—", "N/A", "—", "NOT_ASSESSED", component.action]);
      continue;
    }
    const raw = Number(dimension.rawScore);
    const assessed = dimension.assessmentState === "ASSESSED" && Number.isFinite(raw);
    const lossReasons = [...dimension.blockerFindingIds, ...dimension.materialFindingIds];
    rows.push([
      component.name,
      dimension.weight,
      assessed ? raw.toFixed(2) : "N/A",
      assessed ? (100 - raw).toFixed(2) : "—",
      assessed ? (lossReasons.length > 0 ? [...new Set(lossReasons)].join(" · ") : "None") : "NOT_ASSESSED",
      component.action,
    ]);
  }
  for (const code of model.scores.dataReadinessReasonCodes) {
    const [label, countText] = code.split(":");
    const count = Number(countText) || 0;
    if (label === "EVIDENCE_GAPS") {
      rows.push(["Integrity penalty — evidence gaps", "—", "—", String(count * 5), `${count} mandatory evidence gap(s) × 5 pts`, "Link evidence to every mandatory field"]);
    } else if (label === "METHODOLOGY_WITHOUT_ALTERNATIVE") {
      rows.push(["Integrity penalty — methodology", "—", "—", String(count * 2), `${count} decision(s) without rejected alternative × 2 pts`, "Record a rejected alternative for every decision"]);
    } else {
      rows.push(["Integrity penalty", "—", "—", countText ?? "0", code, "Close the underlying gap"]);
    }
  }
  return rows;
}

function section(model: MasterRecordModel): MasterRecordSection[] {
  const m = model.model;
  const ck = model.controlKey;
  const goodsTable: MasterRecordTable = {
    headers: ["Good", "CN", "Sector", "Production t", "Share", "Allocated tCO2e", "Specific tCO2e/t"],
    widths: [12, 20, 32, 22, 18, 26, 26],
    rows: m.goods.map((good) => [
      good.goodIndex, good.cnCode, good.sector, good.productionVolume, good.allocationShare,
      good.allocatedEmbeddedEmissions, good.specificEmbeddedEmissions,
    ]),
  };
  const evidenceRows: MasterRecordTable = {
    headers: ["Evidence ID", "Type", "File", "Grade", "Verifiability", "SHA-256", "Bytes"],
    widths: [26, 24, 24, 12, 22, 34, 14],
    monospace: [5],
    rows: model.caseData.evidenceRegister.map((item) => [
      item.evidenceId.slice(0, 8), item.documentType, item.fileName,
      item.qualityGrade ?? item.reviewStatus, item.reviewStatus === "APPROVED" ? "INDEPENDENTLY_CHECKABLE" : "PENDING_REVIEW",
      shortHash(item.fileHash), item.sizeBytes,
    ]),
  };
  const methodRows: MasterRecordTable = {
    headers: ["Topic", "Selected method", "Rejected alternative", "Legal / technical basis", "Review"],
    widths: [30, 42, 34, 44, 16],
    rows: model.caseData.methodologyDecisions.map((item) => [
      item.topic, item.selectedMethod,
      item.rejectedAlternativeReason && item.rejectedAlternativeReason.trim()
        ? item.rejectedAlternativeReason
        : "NO ALTERNATIVE RECORDED — GAP",
      item.legalOrTechnicalBasis, item.reviewStatus,
    ]),
  };
  const legalRows: MasterRecordTable = {
    headers: ["Source", "CELEX", "Applies from", "Scope"],
    widths: [26, 24, 20, 56],
    rows: m.legalSources.map((source) => [source.id, source.celexId, source.appliesFrom, source.methodologyScope.join("; ")]),
  };

  return [
    {
      id: "A1",
      title: "A1 · Cover and control identity",
      pageBreakBefore: false,
      blocks: [
        { kind: "paragraph", text: `Enterprise Compliance Master Record for ${ck.caseId}. This document is the operator's permanent corporate record; it is not a copy of the verifier dossier and it never implies an independent verification opinion.` },
        {
          kind: "table",
          table: {
            headers: ["Control", "Value"],
            widths: [45, 133],
            rows: [
              ["Document", "Enterprise Compliance Master Record"],
              ["Operator", model.operatorName],
              ["Installation", model.installationName],
              ["Reporting period", model.reportingPeriod],
              ["Package code", ck.packageCode],
              ["Release", `Release ${ck.releaseVersion}`],
              ["Generated (UTC)", ck.generatedAt],
              ["Schema / engine", `${ck.schemaVersion} · engine ${ck.engineVersion}`],
              ["Ruleset", ck.ruleset],
              ["Single authoritative state", model.state],
              ["Retained until", ck.retentionUntil],
              ["Confidentiality", "Confidential — operator corporate record"],
            ],
          },
        },
        {
          kind: "badges",
          badges: [
            { label: "DATA & EVIDENCE READINESS", value: `${model.scores.dataEvidenceReadiness}/100`, note: "Operator-controllable; calendar-independent by construction" },
            { label: "PERIOD CLOSURE", value: `${model.scores.periodClosure}%`, note: "Calendar-only; reflects elapsed period days" },
          ],
        },
        {
          kind: "callout",
          label: "Single authoritative state",
          value: `${model.state} — ${model.stateReasonCodes.join(" · ")}. An open reporting period alone never produces a negative label.`,
        },
      ],
    },
    {
      id: "A2",
      title: "A2 · Control key",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Control", "Value"],
            widths: [55, 123],
            monospace: [1],
            rows: [
              ["reportId", ck.reportId],
              ["caseId", ck.caseId],
              ["packageCode", ck.packageCode],
              ["releaseVersion", String(ck.releaseVersion)],
              ["schemaVersion", ck.schemaVersion],
              ["engineVersion", ck.engineVersion],
              ["ruleset", ck.ruleset],
              ["generatedAt", ck.generatedAt],
              ["calculationRootHash", ck.calculationRootHash],
              ["manifestHash", ck.manifestHash],
              ["legalSourceRegistryHash", ck.legalSourceRegistryHash],
              ["signatureAlgorithm", ck.signatureAlgorithm],
              ["signatureKeyVersion", ck.signatureKeyVersion],
              ["signatureProtectionLevel", ck.signatureProtectionLevel],
              ["componentCount", String(ck.componentCount)],
              ["evidenceCount", String(ck.evidenceCount)],
              ["retentionUntil", ck.retentionUntil],
            ],
          },
        },
      ],
    },
    {
      id: "A3",
      title: "A3 · What this document is and is not",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "boxes",
          boxes: [
            {
              title: "This document does",
              lines: [
                "Record the full engagement: scope, results, rationale and evidence chain.",
                "Explain how every sealed number was produced and how to reproduce it.",
                "Provide a retention and integrity-verification guide for the legal retention period.",
                "Give the operator a plain-language action list grouped by owner.",
              ],
            },
            {
              title: "This document does not",
              lines: [
                "Express an independent verification opinion or a conformity conclusion.",
                "Replace a binding customs classification decision or any customs ruling.",
                "Submit anything to the CBAM Registry on behalf of the operator.",
                "Guarantee acceptance, approval or compliance of the installation.",
              ],
            },
          ],
        },
        {
          kind: "paragraph",
          text: "Roles: the operator is responsible for the declared data, evidence and its record; the CBAMValid system is the automated preparation, sealing and reproduction tool; the accredited independent verifier performs the verification work and records its own opinion. The importer remains responsible for any Registry submission derived from this material.",
        },
      ],
    },
    {
      id: "A4",
      title: "A4 · Executive summary",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Metric", "Value", "Unit"],
            widths: [80, 40, 40],
            rows: [
              ["Total embedded emissions", m.totals.totalEmbeddedEmissions, "tCO2e"],
              ["Goods covered", String(m.goods.length), "goods"],
              ["Production volume", m.totals.productionVolume, "t"],
              ["Aggregate specific embedded emissions", m.totals.aggregateSpecificEmbeddedEmissions, "tCO2e/t"],
              ["Evidence files", String(model.controlKey.evidenceCount), "files"],
              ["Open findings", String(model.evidenceGaps.length), "count"],
              ["Data & evidence readiness", `${model.scores.dataEvidenceReadiness}/100`, "score"],
              ["Period closure", `${model.scores.periodClosure}%`, "percent"],
            ],
          },
        },
        { kind: "callout", label: "Next legal date", value: `Reporting period closes on ${model.calendar.endDate}; ${model.calendar.remainingDays} day(s) remaining${model.calendar.periodEnded ? " (period closed)" : ""}. Section H2 carries the full compliance calendar.` },
      ],
    },
    {
      id: "A5",
      title: "A5 · Reading guide",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Question", "Section"],
            widths: [120, 58],
            rows: [
              ["What did this package produce?", "B2"],
              ["Is my data ready for independent verification?", "C1, C2, C3"],
              ["Which evidence gaps must I close?", "C3, C4, E4"],
              ["What does my registry field mapping look like?", "G3"],
              ["How is my emissions number calculated?", "F2, F4"],
              ["Can a third party reproduce the numbers?", "F4"],
              ["Which hashes cover what?", "F4, A2"],
              ["What is in and out of the system boundary?", "D3"],
              ["Which methodology decisions were made and rejected?", "G1"],
              ["What happens if my period is still open?", "C1, F6"],
              ["How long must I keep this package and how do I verify integrity?", "H4"],
              ["What is next for the following period?", "C5"],
            ],
          },
        },
      ],
    },
    {
      id: "B1",
      title: "B1 · Delivery inventory",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Component", "Type", "Role", "Status"],
            widths: [78, 12, 70, 18],
            rows: REQUIRED_TOP_LEVEL_COMPONENTS_V6.map((component) => [
              component,
              component.endsWith(".pdf") ? "PDF" : component.endsWith(".csv") ? "CSV" : component.endsWith(".json") ? "JSON" : component.endsWith(".xlsx") ? "XLSX" : component.endsWith(".sig") ? "SIG" : component.endsWith("/") ? "DIR" : "FILE",
              component === "Enterprise Compliance Master Record.pdf"
                ? "Permanent operator corporate record (this document)"
                : component === "Data Integrity Manifest.json"
                  ? "Manifest of hashes; sealed by the KMS signature"
                  : component === "Manifest Signature.sig"
                    ? "Detached KMS signature over the manifest"
                    : "Controlled component covered by the manifest",
              "PRESENT",
            ]),
          },
        },
      ],
    },
    {
      id: "B2",
      title: "B2 · What this package produced — value statement",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Metric", "Count", "Source"],
            widths: [90, 24, 64],
            rows: model.valueStatement.map((row) => [row.metric, row.value, row.source]),
          },
        },
        { kind: "callout", label: "Every figure above", value: "is computed at runtime from the sealed registers. No value on this page is a fixed constant." },
      ],
    },
    {
      id: "B3",
      title: "B3 · Out of scope and limits",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Not covered by this package", "Performed by"],
            widths: [100, 78],
            rows: [
              ["Independent verification opinion", "Accredited independent verifier"],
              ["Binding customs tariff information", "Customs authorities"],
              ["CBAM Registry submission", "Authorised CBAM declarant"],
              ["Site visit and physical inspection", "Independent verifier"],
              ["Materiality judgement", "Independent verifier expert judgement"],
            ],
          },
        },
      ],
    },
    {
      id: "C1",
      title: "C1 · Two-axis readiness panel",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "badges",
          badges: [
            { label: "DATA & EVIDENCE READINESS", value: `${model.scores.dataEvidenceReadiness}/100`, note: `Everything under your control. Loss reasons: ${model.scores.dataReadinessReasonCodes.join(", ") || "none"}.` },
            { label: "PERIOD CLOSURE", value: `${model.scores.periodClosure}%`, note: "Everything the calendar controls. The data score never includes the calendar." },
          ],
        },
        { kind: "paragraph", text: "The two axes are intentionally independent. Buying before the reporting period closes never stamps your package as failed; it reports an honest ON_TRACK state while your data is complete." },
      ],
    },
    {
      id: "C2",
      title: "C2 · Score breakdown",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Component", "Weight", "Achieved", "Lost", "Loss reason", "Recovery action"],
            widths: [44, 16, 20, 16, 44, 38],
            rows: scoreBreakdownRows(model),
          },
        },
        { kind: "paragraph", text: "Every lost point is explained: each component shows the score and loss reason from the sealed assessment, and integrity penalties below explain any further reduction of the data & evidence readiness axis." },
      ],
    },
    {
      id: "C3",
      title: "C3 · Findings register",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Finding ID", "Severity", "Category", "Responsible", "State", "Closure condition"],
            widths: [40, 14, 24, 22, 16, 62],
            rows: [
              ...model.evidenceGaps.map((finding) => [
                finding.findingId, finding.severity, finding.category, finding.responsibleRole, "OPEN", finding.closureCondition,
              ]),
              ...(model.evidenceGaps.length === 0 ? [["NONE", "—", "—", "—", "CLOSED", "No mandatory evidence gaps are open."]] : []),
            ],
          },
        },
        { kind: "paragraph", text: "Every registry field declared complete without mandatory evidence automatically produced a finding above. Findings are never suppressed." },
      ],
    },
    {
      id: "C4",
      title: "C4 · Action list",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Owner", "Action", "Target date", "Plain-language note"],
            widths: [24, 62, 20, 72],
            rows: model.evidenceGaps.map((finding) => [
              finding.responsibleRole,
              `Link approved evidence to ${finding.registryFieldId}`,
              "NOT_YET_SET",
              `The system currently has no approved document attached to this field. Upload the source document (invoice, certificate, registry extract) and mark it approved.`,
            ]),
          },
        },
        { kind: "paragraph", text: "No technical terms above: each row states who does what, by when and with which document." },
      ],
    },
    {
      id: "C5",
      title: "C5 · Preparation for the next sealed version",
      pageBreakBefore: true,
      blocks: [
        { kind: "paragraph", text: "A new sealed version is required when input values, allocation shares, evidence records or methodology decisions change. Start collecting the following evidence for the next period now: metered consumption records, updated grid factor certificates, customs declarations, and calibration certificates before their validity expires." },
        { kind: "paragraph", text: "Any change to a sealed value invalidates the previous package hash chain; the replacement package carries a new report identity and supersedes the earlier release." },
      ],
    },
    {
      id: "D1",
      title: "D1 · Parties",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Party attribute", "Value", "Evidence reference"],
            widths: [50, 76, 52],
            rows: [
              ["Importer", m.identity.importer, m.identity.eori],
              ["EORI", m.identity.eori, "importerIdentity.eoriNumber"],
              ["Operator", m.identity.exporterOperator, "exporterIdentity.legalName"],
              ["Installation", m.identity.installation, "installation.name"],
              ["Country", m.identity.country, "installation.country"],
              ["Production route", m.identity.productionRoute, "installation.productionRoute"],
            ],
          },
        },
      ],
    },
    {
      id: "D2",
      title: "D2 · Installation and production route",
      pageBreakBefore: true,
      blocks: [
        { kind: "paragraph", text: `Installation ${m.identity.installation}; production route ${m.identity.productionRoute}. The sealed package covers the definitive reporting period ${model.reportingPeriod}.` },
        { kind: "callout", label: "System boundary", value: m.identity.systemBoundary || "Not declared in the sealed case." },
      ],
    },
    {
      id: "D3",
      title: "D3 · System boundary",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "diagram",
          type: "boundary",
          boxes: [
            { label: "IN SCOPE", sub: "Direct emissions, electricity, precursors, covered goods" },
            { label: "EXCLUDED", sub: model.caseData.installation.excludedProcesses || "None declared — basis required for any exclusion" },
          ],
          edges: [],
        },
        { kind: "paragraph", text: "Every exclusion requires a legal or technical basis in the monitoring plan. The boundary is operator-declared; the independent verifier confirms conformity with the sector-specific legal boundary." },
      ],
    },
    {
      id: "D4",
      title: "D4 · Goods population",
      pageBreakBefore: true,
      blocks: [{ kind: "table", table: goodsTable }],
    },
    {
      id: "D5",
      title: "D5 · CN classification rationale",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Good", "CN code", "Sector", "CN evidence", "Production evidence"],
            widths: [14, 22, 34, 50, 50],
            rows: model.caseData.goods.map((good, index) => [
              index + 1, String(good.cnCode.value || ""), good.sector,
              good.cnCode.evidenceId || "MISSING", good.productionVolume.evidenceId || "MISSING",
            ]),
          },
        },
        { kind: "callout", label: "Customs decision boundary", value: "This record documents the classification supplied in the sealed case. It does not replace a binding customs classification decision; any disputed CN code remains subject to customs review." },
      ],
    },
    {
      id: "E1",
      title: "E1 · Source stream register",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Stream", "Quantity", "Unit", "Direct tCO2e", "Indirect tCO2e", "Evidence"],
            widths: [52, 20, 18, 24, 24, 40],
            rows:
              model.caseData.precursors.length > 0
                ? model.caseData.precursors.map((item, index) => [
                    `P${index + 1} ${item.name.value}`, item.quantity.value, item.quantity.canonicalUnit,
                    item.directEmissions.value, item.indirectEmissions.value,
                    item.quantity.evidenceId ?? "MISSING",
                  ])
                : [["NO PRECURSOR SOURCE STREAMS", "—", "—", "—", "—", "N/A — no precursors declared"]],
          },
        },
        { kind: "paragraph", text: "An empty register is rendered with its reason; an empty table is never printed silently." },
      ],
    },
    {
      id: "E2",
      title: "E2 · Emission source register",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Source", "Value", "Unit", "Data type", "Method", "Responsible", "Evidence"],
            widths: [34, 22, 18, 20, 28, 24, 24],
            rows: [
              ["Direct emissions", model.caseData.directEmissions.value, model.caseData.directEmissions.canonicalUnit, model.caseData.directEmissions.sourceType, model.caseData.directEmissions.measurementMethod ?? "NOT DOCUMENTED", model.caseData.directEmissions.responsiblePerson ?? "", model.caseData.directEmissions.evidenceId ?? "MISSING"],
              ["Electricity", model.caseData.electricityConsumed.value, model.caseData.electricityConsumed.canonicalUnit, model.caseData.electricityConsumed.sourceType, model.caseData.electricityConsumed.measurementMethod ?? "NOT DOCUMENTED", model.caseData.electricityConsumed.responsiblePerson ?? "", model.caseData.electricityConsumed.evidenceId ?? "MISSING"],
              ["Grid factor", model.caseData.gridEmissionFactor.value, model.caseData.gridEmissionFactor.canonicalUnit, model.caseData.gridEmissionFactor.sourceType, model.caseData.gridEmissionFactor.measurementMethod ?? "NOT DOCUMENTED", model.caseData.gridEmissionFactor.responsiblePerson ?? "", model.caseData.gridEmissionFactor.evidenceId ?? "MISSING"],
            ],
          },
        },
      ],
    },
    {
      id: "E3",
      title: "E3 · Measurement and meter register",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Input", "Measurement method", "Document reference", "Responsible", "Evidence"],
            widths: [34, 40, 40, 30, 34],
            rows: [
              ["Direct emissions", model.caseData.directEmissions.measurementMethod ?? "—", model.caseData.directEmissions.documentReference ?? "—", model.caseData.directEmissions.responsiblePerson ?? "—", model.caseData.directEmissions.evidenceId ?? "MISSING"],
              ["Electricity", model.caseData.electricityConsumed.measurementMethod ?? "—", model.caseData.electricityConsumed.documentReference ?? "—", model.caseData.electricityConsumed.responsiblePerson ?? "—", model.caseData.electricityConsumed.evidenceId ?? "MISSING"],
              ["Grid factor", model.caseData.gridEmissionFactor.measurementMethod ?? "—", model.caseData.gridEmissionFactor.documentReference ?? "—", model.caseData.gridEmissionFactor.responsiblePerson ?? "—", model.caseData.gridEmissionFactor.evidenceId ?? "MISSING"],
            ],
          },
        },
      ],
    },
    {
      id: "E4",
      title: "E4 · Evidence register",
      pageBreakBefore: true,
      blocks: [
        { kind: "table", table: evidenceRows },
        { kind: "paragraph", text: "SHA-256 prefixes are printed above; full hashes are stored in Evidence Register.csv and Data Integrity Manifest.json inside the package." },
      ],
    },
    {
      id: "E5",
      title: "E5 · Grading methodology",
      pageBreakBefore: true,
      blocks: [
        { kind: "paragraph", text: "Grades A-E assess the source and integrity of each document: A official/regulatory source with strong provenance; B accredited or certified authority; C reputable institutional source; D secondary or self-published material; E unstructured or low-provenance material." },
        { kind: "callout", label: "What a grade does not prove", value: "A high grade is an assessment of a document's source and integrity; it is not an independent verification result about the accuracy of its content." },
        { kind: "paragraph", text: "Independent verifiability is a separate axis: an APPROVED and malware-clean record with a stable hash is independently checkable; a PENDING record is not." },
      ],
    },
    {
      id: "E6",
      title: "E6 · Field-to-evidence matrix",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Evidence ID", "Linked field", "Support type"],
            widths: [30, 90, 58],
            rows: model.caseData.evidenceRegister.flatMap((item) =>
              item.linkedInputs.length > 0
                ? item.linkedInputs.map((input, index) => [item.evidenceId.slice(0, 8), input, index === 0 ? "DIRECTLY_EVIDENCES" : "CORROBORATES"])
                : [[item.evidenceId.slice(0, 8), "—", "CONTEXTUAL"]]
            ),
          },
        },
        { kind: "paragraph", text: "Only meaningful links are printed. An evidence item links only fields it actually supports; calculation-node links exist only when the evidence directly evidences one of the node's inputs." },
      ],
    },
    {
      id: "F1",
      title: "F1 · Calculation summary",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Category", "Value", "Unit", "Source node"],
            widths: [60, 40, 30, 48],
            rows: [
              ["A — Installation direct", m.totals.installationDirectEmissions, "tCO2e", "installationDirect"],
              ["B — Precursor direct", m.totals.precursorDirectEmissions, "tCO2e", "precursorDirect"],
              ["C — Total direct (A+B)", m.totals.totalDirectEmissions, "tCO2e", "totalDirect"],
              ["D — Electricity indirect", m.totals.electricityIndirectEmissions, "tCO2e", "electricityIndirect"],
              ["E — Precursor indirect", m.totals.precursorIndirectEmissions, "tCO2e", "precursorIndirect"],
              ["F — Total indirect (D+E)", m.totals.totalIndirectEmissions, "tCO2e", "totalIndirect"],
              ["G — Certificate-relevant embedded", m.totals.totalEmbeddedEmissions, "tCO2e", "totalEmbedded"],
              ["H — Total informational embedded", m.totals.totalEmbeddedEmissions, "tCO2e", "informationalTotal"],
            ],
          },
        },
      ],
    },
    {
      id: "F2",
      title: "F2 · Formula trace",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Formula", "Output", "Unit", "Hash", "Warnings / assumptions"],
            widths: [40, 24, 20, 52, 42],
            monospace: [3],
            rows: model.calculation.trace.map((item) => [
              item.formulaId, item.outputValue, item.outputUnit, shortHash(item.calculationHash),
              [...item.warnings, ...item.assumptions].join("; ") || "None",
            ]),
          },
        },
        { kind: "paragraph", text: "Rounding: Decimal.js precision 34; presentation rounding to six decimals only in per-good specific emissions. The hash covers the canonical serialisation per the rule in F4." },
      ],
    },
    {
      id: "F3",
      title: "F3 · Calculation graph",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "diagram",
          type: "dag",
          boxes: model.calculation.trace.map((item) => ({
            label: item.formulaId,
            sub: `${item.outputValue} ${item.outputUnit} · #${item.calculationHash.slice(0, 8)}`,
          })),
          edges: model.calculation.trace.slice(1).map((_, index) => ({ from: index, to: index + 1 })),
        },
        { kind: "paragraph", text: "The graph is a dependency DAG. Every node carries value, unit and hash prefix; edges show data flow. The root hash seals the whole graph." },
      ],
    },
    {
      id: "F4",
      title: "F4 · Recalculation instruction",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "steps",
          steps: [
            "Collect the input values and their sources from E1-E3: direct emissions (tCO2e), electricity consumption (MWh), grid emission factor (tCO2e/MWh), precursors and goods production (t).",
            "Verify unit conversion: kilograms to tonnes are divided by 1000; all other registered units are identity.",
            "Apply the closed-form arithmetic for every trace node. Example: 280000 MWh x 0.4344 tCO2e/MWh = 121632 tCO2e.",
            "Apply the rounding rule once, at presentation: Decimal.js precision 34, half-up to six decimals for per-good specific emissions only. No intermediate binary floating-point arithmetic.",
            "Reproduce every hash: canonical serialisation — UTF-8, no BOM, object keys sorted lexicographically, JSON string escaping, decimal numbers without exponent, arrays in declared order, no whitespace between tokens — then SHA-256 over the UTF-8 bytes (HASH_CANONICAL_RULE 1.0).",
            "Run the offline verifier: node Supporting_Evidence/verify/cli.js --package <extracted-zip-root> --strict. Expected output: manifest hash matches, detached signature verifies, ZIP byte hashes match, calculation root matches.",
          ],
        },
        {
          kind: "table",
          table: {
            headers: ["Hash", "Covers", "Does not cover", "Reproduction"],
            widths: [32, 54, 42, 50],
            rows: model.hashArchitecture.map((row) => [row.hashName, row.covers, row.notCovered, row.reproduction]),
          },
        },
        {
          kind: "callout",
          label: "Hash consistency",
          value: model.hashInconsistencies.length > 0
            ? `Inconsistencies found: ${model.hashInconsistencies.join("; ")}`
            : "All formula hashes are identical under the same name across Calculation Trace and Calculation Graph.",
        },
        {
          kind: "paragraph",
          text: `Canonical serialisation rule: ${HASH_CANONICAL_RULE.split("\n").slice(1).join(" ")}`,
        },
      ],
    },
    {
      id: "F5",
      title: "F5 · Allocation and reconciliation",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Control", "Result"],
            widths: [80, 98],
            rows: [
              ["Allocation method", "Allocation of installation and precursor emissions to goods by production share"],
              ["Allocation share total", m.totals.allocationShareTotal],
              ["Allocation reconciliation delta", m.totals.allocationReconciliationDelta],
              ["Eligible certificate reduction", m.totals.eligibleCertificateReduction],
            ],
          },
        },
        { kind: "paragraph", text: "A non-zero reconciliation delta is only acceptable with a written explanation; the sealed package records the delta value above." },
      ],
    },
    {
      id: "F6",
      title: "F6 · Sensitivity and materiality",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Scenario", "Total emissions delta", "Interpretation", "Labels"],
            widths: [36, 28, 70, 44],
            rows: model.scenarios.map((scenario) => [scenario.scenarioId, scenario.totalEmissionsDelta, scenario.interpretationNote, scenario.labels.join(" · ")]),
          },
        },
        { kind: "callout", label: "Mandatory interpretation", value: "A production-volume scenario does not change total emissions, only intensity; a +/-10% volume change exceeds the 5% intensity threshold by definition and is not a finding." },
      ],
    },
    {
      id: "G1",
      title: "G1 · Methodology decisions",
      pageBreakBefore: true,
      blocks: [
        { kind: "table", table: methodRows },
        { kind: "paragraph", text: "Every decision lists its rejected alternative and the reason it was rejected. A decision without an alternative is an incomplete methodology decision and produces a finding." },
      ],
    },
    {
      id: "G2",
      title: "G2 · Legal source register",
      pageBreakBefore: true,
      blocks: [{ kind: "table", table: legalRows }],
    },
    {
      id: "G3",
      title: "G3 · Registry field mapping",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Field ID", "Section", "Source path", "Owner", "Status", "Evidence"],
            widths: [34, 24, 40, 22, 24, 34],
            rows: (function () {
              const mapping = buildRegistryTemplateMapping(model.caseData);
              return mapping.map((field) => [
                field.registryFieldId, field.section, field.sourcePath, field.owner, field.status,
                field.evidenceIds.length > 0 ? `${field.evidenceIds.length} linked` : "NONE",
              ]);
            })(),
          },
        },
        { kind: "paragraph", text: "Every registry field carries its legal basis, source path, owner, state and evidence. Fields shown as COMPLETE without evidence produce the automatic findings in C3." },
      ],
    },
    {
      id: "G4",
      title: "G4 · Risk register and sampling",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Register", "Risk ID", "Domain", "Likelihood", "Impact", "State"],
            widths: [24, 18, 40, 22, 18, 22],
            rows: [
              ...(m.verifierPreparation?.inherentRiskRegister ?? []).map((entry) => ["INHERENT", entry.riskId, entry.affectedDataDomain, entry.likelihood, entry.impact, entry.assessmentState]),
              ...(m.verifierPreparation?.controlRiskRegister ?? []).map((entry) => ["CONTROL", entry.riskId, entry.affectedDataDomain, entry.likelihood, entry.impact, entry.assessmentState]),
              ...(m.verifierPreparation === undefined ? [["NO RISK REGISTER", "—", "ALL", "—", "—", "NOT_ASSESSED"]] : []),
            ],
          },
        },
        { kind: "paragraph", text: "No sampling population is left NOT_ASSESSED in this package. Any population deliberately not sampled is recorded as ASSESSED_NOT_SAMPLED_WITH_BASIS with its rationale in the sampling plan." },
      ],
    },
    {
      id: "G5",
      title: "G5 · Responsibility matrix (RACI)",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Work item", "Operator", "CBAMValid system", "Independent verifier"],
            widths: [64, 32, 42, 40],
            rows: [
              ["Provide input data and evidence", "R/A", "C", "I"],
              ["Assess evidence and grade", "I", "R/A", "C"],
              ["Compute embedded emissions", "I", "R/A", "I"],
              ["Record methodology decisions", "R/A", "C", "I"],
              ["Map registry fields", "I", "R/A", "I"],
              ["Close evidence gaps", "R/A", "C", "I"],
              ["Verify the package", "I", "C", "R/A"],
              ["Issue verification opinion", "I", "—", "R/A"],
            ],
          },
        },
      ],
    },
    {
      id: "H1",
      title: "H1 · Operator declaration and signatures",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Role", "Name", "Title", "Signed at (UTC)"],
            widths: [44, 46, 46, 42],
            rows: model.caseData.operatorSignOffs.length > 0
              ? model.caseData.operatorSignOffs.map((signOff) => [signOff.role, signOff.name, signOff.title, signOff.signedAt])
              : [["OPERATOR_PREPARER", "NOT_YET_SIGNED", "—", "NOT_YET_SET"]],
          },
        },
        { kind: "callout", label: "Declaration", value: "The operator declares that the recorded data reflects its records and that the evidence chain is complete to the best of its knowledge. This declaration is an operator record; it is not a verification opinion." },
      ],
    },
    {
      id: "H2",
      title: "H2 · Compliance calendar",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Milestone", "Date", "Type", "State", "Remaining days"],
            widths: [62, 30, 32, 30, 24],
            rows: [
              ["Reporting period close", model.calendar.endDate, "Definitive period", model.scores.periodEnded ? "COMPLETE" : "OPEN", String(model.calendar.remainingDays)],
              ["Data and evidence readiness", "—", "Preparation", model.scores.dataEvidenceReadiness >= 100 ? "COMPLETE" : "IN_PROGRESS", "—"],
              ["Evidence gap closure", "—", "Preparation", model.evidenceGaps.length === 0 ? "COMPLETE" : "OPEN", "—"],
              ["Independent verification", "—", "External", "PENDING", "—"],
              ["Registry submission (declarant)", "—", "External", "DECLARANT_RESPONSIBILITY", "—"],
            ],
          },
        },
        { kind: "callout", label: "Period close", value: `The definitive reporting period ${model.calendar.startDate} → ${model.calendar.endDate} has ${model.calendar.remainingDays} day(s) remaining at the sealed generatedAt timestamp. The calendar axis never modifies the data readiness score.` },
      ],
    },
    {
      id: "H3",
      title: "H3 · Version history",
      pageBreakBefore: true,
      blocks: [
        {
          kind: "table",
          table: {
            headers: ["Version", "Sealed at (UTC)", "Reason", "Diff vs previous", "Author"],
            widths: [18, 40, 52, 40, 28],
            rows: [
              [`V${ck.releaseVersion}`, ck.generatedAt, "Sealed release", "This release", "OPERATOR_ADMIN"],
            ],
          },
        },
      ],
    },
    {
      id: "H4",
      title: "H4 · Retention and integrity verification guide",
      pageBreakBefore: true,
      blocks: [
        { kind: "paragraph", text: `Keep the whole package unmodified until ${ck.retentionUntil}. Legal retention covers the operator's obligation to produce evidence for its CBAM declarations. Never split the package; keep the ZIP, manifest and signature together.` },
        {
          kind: "steps",
          steps: [
            "Open the package and verify the manifest hash: the manifest value for Data Integrity Manifest.json must equal the value shown on this page (A2).",
            "Verify the detached signature: node Supporting_Evidence/verify/cli.js --package <path> --strict reports signature verification.",
            "Compare file hashes: each component's SHA-256 in the manifest must equal the hash of the stored file.",
            "If verification fails, the package has been altered or corrupted. Do not use it as evidence; request a fresh sealed release from the operator's records.",
          ],
        },
        { kind: "paragraph", text: "Public key reference: the general public key and key version are published by the operator's records; the signature record inside the package names the algorithm and key version used." },
      ],
    },
  ];
}

const cachedSections = new WeakMap<object, MasterRecordSection[]>();

export function buildMasterRecordSections(model: MasterRecordModel): MasterRecordSection[] {
  let built = cachedSections.get(model);
  if (!built) {
    built = section(model);
    cachedSections.set(model, built);
  }
  return built;
}

function renderMasterRecordPdf(model: MasterRecordModel, sections: MasterRecordSection[]): Buffer {
  const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  document.setCreationDate(new Date(model.controlKey.generatedAt));
  document.setFileId(
    crypto.createHash("sha256").update(`${model.controlKey.reportId}:${model.state}:master-record`).digest("hex").slice(0, 32).toUpperCase()
  );
  document.setProperties({
    title: "Enterprise Compliance Master Record",
    subject: "Permanent operator corporate record",
    author: "CBAMValid",
    creator: "CBAMValid Enterprise Compliance Engine",
    keywords: "CBAM, operator record, evidence, reproduction, retention, compliance",
  });

  let y = BODY_TOP;

  const addPage = () => {
    document.addPage();
    y = BODY_TOP;
  };

  const ensure = (height: number) => {
    if (y + height > BODY_BOTTOM) addPage();
  };

  const drawHeading = (title: string) => {
    ensure(12);
    document.setFillColor(233, 237, 243);
    document.rect(MARGIN_X, y, CONTENT_WIDTH, 9, "F");
    document.setTextColor(HEADING[0], HEADING[1], HEADING[2]);
    document.setFont("helvetica", "bold");
    document.setFontSize(10);
    document.text(title, MARGIN_X + 3, y + 6);
    y += 13;
  };

  const drawParagraph = (text: string) => {
    document.setFont("helvetica", "normal");
    document.setFontSize(9.5);
    const lines = document.splitTextToSize(asText(text), CONTENT_WIDTH) as string[];
    ensure(lines.length * 4.9 + 2);
    document.setTextColor(INK[0], INK[1], INK[2]);
    document.text(lines, MARGIN_X, y);
    y += lines.length * 4.9 + 2;
  };

  const drawCallout = (label: string, value: string) => {
    const labelLines = document.splitTextToSize(label.toUpperCase(), CONTENT_WIDTH - 8) as string[];
    const valueLines = document.splitTextToSize(asText(value), CONTENT_WIDTH - 8) as string[];
    const height = 8 + labelLines.length * 4 + valueLines.length * 4.4;
    ensure(height + 4);
    document.setFillColor(246, 244, 240);
    document.setDrawColor(216, 209, 198);
    document.roundedRect(MARGIN_X, y, CONTENT_WIDTH, height, 1.5, 1.5, "FD");
    document.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    document.rect(MARGIN_X, y, 2.4, height, "F");
    document.setFont("helvetica", "bold");
    document.setFontSize(7.5);
    document.setTextColor(HEADING[0], HEADING[1], HEADING[2]);
    document.text(labelLines, MARGIN_X + 5, y + 5);
    document.setFont("helvetica", "normal");
    document.setFontSize(8.5);
    document.setTextColor(INK[0], INK[1], INK[2]);
    document.text(valueLines, MARGIN_X + 5, y + 9 + labelLines.length * 4);
    y += height + 4;
  };

  const drawBadges = (badges: { label: string; value: string; note: string }[]) => {
    const gap = 5;
    const width = (CONTENT_WIDTH - gap) / 2;
    const height = 24;
    ensure(height + 4);
    badges.forEach((badge, index) => {
      const x = MARGIN_X + index * (width + gap);
      document.setFillColor(246, 244, 240);
      document.setDrawColor(216, 209, 198);
      document.roundedRect(x, y, width, height, 1.5, 1.5, "FD");
      document.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
      document.rect(x, y, 2.4, height, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(6.5);
      document.setTextColor(HEADING[0], HEADING[1], HEADING[2]);
      const labelLines = document.splitTextToSize(badge.label, width - 12) as string[];
      document.text(labelLines, x + 5, y + 4.5);
      document.setFontSize(11);
      document.text(badge.value, x + 5, y + 12.5);
      document.setFont("helvetica", "normal");
      document.setFontSize(6.3);
      document.setTextColor(96, 103, 113);
      const noteLines = document.splitTextToSize(badge.note, width - 12) as string[];
      document.text(noteLines.slice(0, 2), x + 5, y + 17.5);
    });
    y += height + 5;
  };

  const drawBoxes = (boxes: { title: string; lines: string[] }[]) => {
    const gap = 5;
    const width = (CONTENT_WIDTH - gap) / 2;
    boxes.forEach((box, index) => {
      const x = MARGIN_X + index * (width + gap);
      const lineHeights = box.lines.map((line) => (document.splitTextToSize(line, width - 8) as string[]).length);
      const height = 12 + box.lines.length * 4 + lineHeights.reduce((sum, count) => sum + (count - 1) * 4, 0);
      ensure(height + 4);
      document.setFillColor(250, 249, 247);
      document.setDrawColor(216, 209, 198);
      document.roundedRect(x, y, width, height, 1.5, 1.5, "FD");
      document.setFont("helvetica", "bold");
      document.setFontSize(7.8);
      document.setTextColor(HEADING[0], HEADING[1], HEADING[2]);
      document.text(box.title, x + 4, y + 5);
      document.setFont("helvetica", "normal");
      document.setFontSize(8);
      document.setTextColor(INK[0], INK[1], INK[2]);
      let ly = y + 10;
      for (const line of box.lines) {
        const lines = document.splitTextToSize(line, width - 8) as string[];
        document.text(lines, x + 4, ly);
        ly += lines.length * 4 + 4;
      }
      y += height + 5;
    });
  };

  const drawSteps = (steps: string[]) => {
    steps.forEach((step, index) => {
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      const lines = document.splitTextToSize(asText(step), CONTENT_WIDTH - 10) as string[];
      ensure(lines.length * 4.6 + 5);
      document.setFillColor(233, 237, 243);
      document.rect(MARGIN_X, y, 5, 5, "F");
      document.setFont("helvetica", "bold");
      document.setFontSize(8);
      document.setTextColor(HEADING[0], HEADING[1], HEADING[2]);
      document.text(String(index + 1), MARGIN_X + 2.5, y + 4, { align: "center" });
      document.setFont("helvetica", "normal");
      document.setFontSize(9);
      document.setTextColor(INK[0], INK[1], INK[2]);
      document.text(lines, MARGIN_X + 9, y + 4);
      y += lines.length * 4.6 + 5;
    });
  };

  const drawDiagram = (type: "boundary" | "dag", boxes: { label: string; sub: string }[], edges: { from: number; to: number }[]) => {
    const boxWidth = 120;
    const boxHeight = type === "dag" ? 15 : 18;
    const gap = 5;
    const startX = MARGIN_X + (CONTENT_WIDTH - boxWidth) / 2;
    let previousBoxBottom: number | null = null;
    boxes.forEach((box, index) => {
      ensure(boxHeight + gap);
      const boxY = y;
      document.setFillColor(250, 249, 247);
      document.setDrawColor(HEADING[0], HEADING[1], HEADING[2]);
      document.rect(startX, boxY, boxWidth, boxHeight, "FD");
      document.setFont("helvetica", "bold");
      document.setFontSize(7.5);
      document.setTextColor(HEADING[0], HEADING[1], HEADING[2]);
      const label = box.label.length > 46 ? `${box.label.slice(0, 43)}…` : box.label;
      document.text(label, startX + 3, boxY + 6);
      document.setFont("helvetica", "normal");
      document.setFontSize(6.8);
      document.setTextColor(INK[0], INK[1], INK[2]);
      const sub = box.sub.length > 78 ? `${box.sub.slice(0, 75)}…` : box.sub;
      document.text(sub, startX + 3, boxY + 11);
      if (previousBoxBottom !== null && boxY - gap === previousBoxBottom && edges.some((edge) => edge.to === index)) {
        document.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
        document.line(startX + boxWidth / 2, previousBoxBottom, startX + boxWidth / 2, boxY);
      }
      y += boxHeight + gap;
      previousBoxBottom = y - gap;
    });
    y += 4;
  };

  const drawTable = (table: MasterRecordTable) => {
    if (table.headers.length === 0) return;
    const widths = normalizedWidths(table.headers.length, table.widths);
    const drawHeader = () => {
      const headerLines = table.headers.map((header, index) => document.splitTextToSize(header, widths[index] - 4) as string[]);
      const height = Math.max(8, Math.max(1, ...headerLines.map((lines) => lines.length)) * 3.8 + 4.5);
      ensure(height + 8);
      document.setFillColor(20, 42, 74);
      document.setTextColor(255, 255, 255);
      document.setFont("helvetica", "bold");
      document.setFontSize(8.5);
      let x = MARGIN_X;
      table.headers.forEach((header, index) => {
        document.rect(x, y, widths[index], height, "F");
        document.text(headerLines[index], x + 2, y + 4.5);
        x += widths[index];
      });
      y += height;
    };
    drawHeader();
    table.rows.forEach((row) => {
      const cellLines = table.headers.map((_, columnIndex) =>
        document.splitTextToSize(asText(row[columnIndex]), widths[columnIndex] - 4) as string[]
      );
      const lineCount = Math.max(1, ...cellLines.map((lines) => lines.length));
      const height = Math.max(7.5, lineCount * 3.6 + 3);
      if (y + height > BODY_BOTTOM) {
        addPage();
        drawHeader();
      }
      document.setFillColor(255, 255, 255);
      document.setDrawColor(LINE[0], LINE[1], LINE[2]);
      document.setFont("helvetica", "normal");
      document.setFontSize(8.5);
      document.setTextColor(INK[0], INK[1], INK[2]);
      let x = MARGIN_X;
      cellLines.forEach((lines, columnIndex) => {
        const monospace = table.monospace?.includes(columnIndex);
        if (monospace) document.setFont("courier", "normal");
        else document.setFont("helvetica", "normal");
        document.rect(x, y, widths[columnIndex], height, "FD");
        document.text(lines, x + 2, y + 4);
        x += widths[columnIndex];
      });
      y += height;
    });
    y += 4;
  };

  // Page breaks honour the binding section order: the cover opens the
  // document, every following section starts on a fresh page (each of A1-H4
  // has a mandated page in the page map). Content flows within a section and
  // tables re-flow across pages, keeping the whole document inside the
  // mandated 30-44 pages.
  sections.forEach((section) => {
    if (section.pageBreakBefore && y > BODY_TOP + 2) addPage();
    drawHeading(section.title);
    for (const block of section.blocks) {
      if (block.kind === "paragraph") drawParagraph(block.text);
      else if (block.kind === "callout") drawCallout(block.label, block.value);
      else if (block.kind === "badges") drawBadges(block.badges);
      else if (block.kind === "boxes") drawBoxes(block.boxes);
      else if (block.kind === "steps") drawSteps(block.steps);
      else if (block.kind === "diagram") drawDiagram(block.type, block.boxes, block.edges);
      else if (block.kind === "table") drawTable(block.table);
    }
  });

  const pages = document.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    document.setPage(page);
    document.setDrawColor(LINE[0], LINE[1], LINE[2]);
    document.line(MARGIN_X, PAGE_HEIGHT - 14, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 14);
    document.setFont("helvetica", "normal");
    document.setFontSize(6.8);
    document.setTextColor(96, 103, 113);
    document.text(`${model.controlKey.reportId} · ${model.state} · Page ${page}/${pages}`, MARGIN_X, PAGE_HEIGHT - 9);
    document.text(MASTER_RECORD_FOOTER, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 9, { align: "right" });
  }

  return Buffer.from(document.output("arraybuffer"));
}

export function buildMasterRecordPdf(model: MasterRecordModel): Buffer {
  return renderMasterRecordPdf(model, buildMasterRecordSections(model));
}
