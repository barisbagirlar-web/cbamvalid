"use client";

// fieldHelpData inline declarations
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCode2,
  FileUp,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";
import { assessReadiness } from "@/lib/cbam/validation/readiness-score";
import { generateFindingsAndActions } from "@/lib/cbam/validation/findings-engine";
import { runEvidenceSufficiency } from "@/lib/cbam/validation/evidence-sufficiency";
import { runQualityControls } from "@/lib/cbam/validation/quality-controls";
import { performDossierCalculations } from "@/lib/cbam/calculator";
import {
  AuditReadyCaseSchema,
  createEmptyInput,
  type AuditReadyCase,
  type EvidenceSupportStatus,
  type InputDatum,
  type UnitCode,
} from "@/lib/cbam/schema";
import { uploadEvidenceFile } from "@/lib/cbam/evidence-upload";
import {
  reviewEvidence,
  saveCase,
  sealReport,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";

interface CaseWizardClientProps {
  sessionUser: { uid: string; email: string };
  initialCase: AuditReadyCase;
  availableEntitlements: PreparationPackEntitlement[];
}

const STEPS = [
  { id: 1, label: "Case setup" },
  { id: 2, label: "Goods" },
  { id: 3, label: "Installation" },
  { id: 4, label: "Direct emissions" },
  { id: 5, label: "Indirect emissions" },
  { id: 6, label: "Precursors & methods" },
  { id: 7, label: "Carbon price & evidence" },
  { id: 8, label: "Verify & generate" },
] as const;

const SECTORS = [
  "IRON_AND_STEEL",
  "ALUMINIUM",
  "CEMENT",
  "FERTILISERS",
  "HYDROGEN",
  "ELECTRICITY",
] as const;

const SOURCE_TYPES = ["PRIMARY", "SECONDARY", "DEFAULT", "ESTIMATED", "REGULATORY"] as const;

const EVIDENCE_LINK_OPTIONS = [
  ["importerIdentity.eoriNumber", "Importer EORI"],
  ["directEmissions", "Direct emissions"],
  ["electricityConsumed", "Electricity consumed"],
  ["gridEmissionFactor", "Grid emission factor"],
] as const;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The requested operation failed.";
}

function setAtPath<T>(source: T, path: string, updater: (value: unknown) => unknown): T {
  const next = structuredClone(source);
  const parts = path.split(/[.]/);
  let cursor: Record<string, unknown> | unknown[] = next as Record<string, unknown>;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = /^\d+$/.test(parts[index]) ? Number(parts[index]) : parts[index];
    cursor = (cursor as Record<string | number, unknown>)[key] as Record<string, unknown> | unknown[];
  }
  const finalKey = /^\d+$/.test(parts.at(-1) || "") ? Number(parts.at(-1)) : parts.at(-1)!;
  (cursor as Record<string | number, unknown>)[finalKey] = updater(
    (cursor as Record<string | number, unknown>)[finalKey]
  );
  return next;
}

function datumValue(value: InputDatum["value"] | null | undefined): string | number {
  return value ?? "";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-bold text-foreground">{children}</label>;
}

function StatusBanner({ status, tone = "neutral" }: { status: string; tone?: "neutral" | "success" | "error" | "warning" }) {
  if (!status) return null;
  const classes = tone === "success"
    ? "border-accent/30 bg-accent-soft text-accent"
    : tone === "error"
      ? "border-red-300 bg-red-50 text-red-900"
      : tone === "warning"
        ? "border-accent/20 bg-accent/5 text-accent"
        : "border-border bg-background text-foreground";
  return <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>{status}</div>;
}

export default function CaseWizardClient({ sessionUser, initialCase, availableEntitlements }: CaseWizardClientProps) {
  const router = useRouter();
  const sealRequestId = useRef<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [caseData, setCaseData] = useState<AuditReadyCase>(() => {
    const parsed = AuditReadyCaseSchema.parse(initialCase);
    const year = Number(parsed.reportingPeriod?.year?.value) || 2025;
    if (!parsed.reportingPeriod.startDate?.value) {
      parsed.reportingPeriod.startDate = createEmptyInput();
      parsed.reportingPeriod.startDate.value = `${year}-01-01`;
    }
    if (!parsed.reportingPeriod.endDate?.value) {
      parsed.reportingPeriod.endDate = createEmptyInput();
      parsed.reportingPeriod.endDate.value = `${year}-12-31`;
    }
    return parsed;
  });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveTone, setSaveTone] = useState<"neutral" | "success" | "error">("neutral");
  const [uploading, setUploading] = useState(false);
  const [evidenceStatus, setEvidenceStatus] = useState("");
  const [sealing, setSealing] = useState(false);
  const [sealStatus, setSealStatus] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDocumentType, setEvidenceDocumentType] = useState("PRODUCTION_RECORD");
  const [evidenceIssuer, setEvidenceIssuer] = useState("");
  const [evidenceIssueDate, setEvidenceIssueDate] = useState("");
  const [evidenceLinkedInput, setEvidenceLinkedInput] = useState("directEmissions");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const usableEntitlements = useMemo(() => availableEntitlements.filter((entitlement) => {
    const status = String(entitlement.status || "").toUpperCase();
    const caseMatches = !entitlement.scopeCaseId || entitlement.scopeCaseId === caseData.caseId;
    return caseMatches && ["AVAILABLE", "ACTIVE", "PURCHASED"].includes(status);
  }), [availableEntitlements, caseData.caseId]);

  const readiness = useMemo(() => {
    const readinessV5 = assessReadiness({ caseData, isDraft: false });
    const { findings } = generateFindingsAndActions(caseData);
    const sufficiency = runEvidenceSufficiency(caseData);
    const controls = runQualityControls(caseData);

    const applicable = controls.filter((control) => control.status !== "NOT_APPLICABLE");
    const passed = applicable.filter((control) => control.status === "PASS");

    const mapFindingSeverity = (severity: string): "BLOCKER" | "MAJOR" | "ADVISORY" => {
      if (severity === "CRITICAL_BLOCKER" || severity === "CRITICAL" || severity === "BLOCKER") return "BLOCKER";
      if (severity === "MATERIAL" || severity === "MAJOR") return "MAJOR";
      return "ADVISORY";
    };

    const allGaps = [
      ...findings.map((f) => ({
        gapId: f.findingId,
        issueType: f.category,
        requirement: f.title,
        severity: mapFindingSeverity(f.severity),
        affectedResult: f.ruleId,
        whyItMatters: f.description,
        requiredEvidence: f.remediationRequirement,
        suggestedAction: f.action?.requiredAction || f.remediationRequirement,
        isBlocking: f.blocksSealing,
        resolutionStatus: f.status,
      })),
      ...sufficiency.filter((s) => s.state !== "SUPPORTED").map((s) => ({
        gapId: s.requirementId,
        issueType: "evidence",
        requirement: `Evidence sufficiency for ${s.inputPath}`,
        severity: (s.blocksSealing ? "BLOCKER" : "MAJOR") as "BLOCKER" | "MAJOR",
        affectedResult: s.inputPath,
        whyItMatters: `Evidence status is ${s.state}. Reason codes: ${s.reasonCodes.join(", ")}`,
        requiredEvidence: `Upload approved and valid evidence for ${s.inputPath}`,
        suggestedAction: `Provide full coverage evidence (${s.coverageNumerator} / ${s.coverageDenominator} days covered)`,
        isBlocking: s.blocksSealing,
        resolutionStatus: "OPEN",
      }))
    ];

    return {
      status: readinessV5.operatorStatus,
      criticalBlockers: allGaps.filter((gap) => gap.isBlocking),
      allGaps,
      isEligibleForSealing: readinessV5.canSeal,
      completenessPercentage: Math.round(Number(readinessV5.score)),
      passedControls: passed.length,
      applicableControls: applicable.length,
    };
  }, [caseData]);

  const calculation = useMemo(() => {
    try {
      return { result: performDossierCalculations(caseData), error: "" };
    } catch (error) {
      return { result: null, error: errorMessage(error) };
    }
  }, [caseData]);

  const updateDatum = (path: string, patch: Partial<InputDatum>) => {
    setCaseData((previous) => setAtPath(previous, path, (current) => ({
      ...(current as InputDatum),
      ...patch,
    })));
  };

  const updatePlain = (path: string, value: unknown) => {
    setCaseData((previous) => setAtPath(previous, path, () => value));
  };

  const persistDraft = async (data = caseData): Promise<void> => {
    if (!data.caseId) throw new Error("CASE_ID_REQUIRED_FOR_SAVE");
    const parsed = AuditReadyCaseSchema.parse(data);
    await saveCase(parsed, parsed.caseId);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("");
    try {
      await persistDraft();
      setSaveTone("success");
      setSaveStatus("Draft saved and validated by the server.");
    } catch (error) {
      console.error("Draft save failed", error);
      setSaveTone("error");
      setSaveStatus(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const addGood = () => {
    setCaseData((previous) => ({
      ...previous,
      goods: [
        ...previous.goods,
        {
          cnCode: createEmptyInput(),
          sector: "IRON_AND_STEEL",
          productionVolume: createEmptyInput("t"),
          shipmentRecords: createEmptyInput(),
          allocationShare: createEmptyInput("fraction"),
        },
      ],
    }));
  };

  const removeGood = (index: number) => {
    setCaseData((previous) => ({ ...previous, goods: previous.goods.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const addPrecursor = () => {
    setCaseData((previous) => ({
      ...previous,
      precursors: [
        ...previous.precursors,
        {
          name: createEmptyInput(),
          quantity: createEmptyInput("t"),
          directEmissions: createEmptyInput("tCO2e"),
          indirectEmissions: createEmptyInput("tCO2e"),
          countryOfOrigin: createEmptyInput(),
        },
      ],
    }));
  };

  const addMethodologyDecision = (topic: string) => {
    if (caseData.methodologyDecisions.some((decision) => decision.topic === topic)) return;
    setCaseData((previous) => ({
      ...previous,
      methodologyDecisions: [
        ...previous.methodologyDecisions,
        {
          decisionId: crypto.randomUUID(),
          topic,
          selectedMethod: topic === "PRECURSOR_SCOPE" ? "No applicable precursors identified" : "Documented operator method",
          reason: "Operator assessment recorded for independent verifier challenge.",
          legalOrTechnicalBasis: "Regulation (EU) 2023/956, Annex IV and active definitive-period ruleset.",
          evidenceIds: [],
          reviewStatus: "ACCEPTED",
          rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
        },
      ],
    }));
  };

  const linkEvidenceToDatum = (data: AuditReadyCase, path: string, evidenceId: string): AuditReadyCase => {
    return setAtPath(data, path, (current) => ({ ...(current as InputDatum), evidenceId }));
  };

  const handleEvidenceUpload = async () => {
    if (!caseData.caseId) {
      setEvidenceStatus("Save the case before uploading evidence.");
      return;
    }
    if (!evidenceFile) {
      setEvidenceStatus("Select a supported evidence file.");
      return;
    }
    setUploading(true);
    setEvidenceStatus("");
    let rollback: (() => Promise<void>) | null = null;
    try {
      const uploaded = await uploadEvidenceFile({
        file: evidenceFile,
        uid: sessionUser.uid,
        caseId: caseData.caseId,
        documentType: evidenceDocumentType,
        issuer: evidenceIssuer,
        issueDate: evidenceIssueDate,
        reportingPeriod: String(caseData.reportingPeriod.year.value || ""),
        linkedInput: evidenceLinkedInput,
      });
      rollback = uploaded.rollback;
      let next = {
        ...caseData,
        evidenceRegister: [...caseData.evidenceRegister, uploaded.record],
      };
      next = linkEvidenceToDatum(next, evidenceLinkedInput, uploaded.record.evidenceId);
      const parsed = AuditReadyCaseSchema.parse(next);
      await persistDraft(parsed);
      setCaseData(parsed);
      setEvidenceFile(null);
      setEvidenceIssuer("");
      setEvidenceIssueDate("");
      setEvidenceStatus("Evidence uploaded and registered as PENDING. Malware scan and internal review are still required.");
    } catch (error) {
      console.error("Evidence upload failed", error);
      if (rollback) {
        try { await rollback(); } catch (rollbackError) { console.error("Evidence rollback failed", rollbackError); }
      }
      setEvidenceStatus(errorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const handleEvidenceReview = async (evidenceId: string, decision: "APPROVED" | "REJECTED") => {
    if (!caseData.caseId) return;
    setEvidenceStatus("");
    try {
      const supportStatus: EvidenceSupportStatus = decision === "APPROVED" ? "SUPPORTED" : "UNSUPPORTED";
      const updated = await reviewEvidence({
        caseId: caseData.caseId,
        evidenceId,
        decision,
        supportStatus,
        reviewerNotes: reviewNotes[evidenceId] || "Internal dossier review completed.",
      });
      setCaseData(updated);
      setEvidenceStatus(`Evidence ${decision.toLowerCase()} by the server-controlled review workflow.`);
    } catch (error) {
      console.error("Evidence review failed", error);
      setEvidenceStatus(errorMessage(error));
    }
  };

  const addCarbonPriceRecord = () => {
    setCaseData((previous) => ({
      ...previous,
      carbonPriceRecords: [
        ...previous.carbonPriceRecords,
        {
          id: crypto.randomUUID(),
          amountPaid: 0,
          applicableEmissions: 0,
          currency: "EUR",
          paymentPeriod: String(previous.reportingPeriod.year.value || ""),
          legislationReference: "",
          eligibleCertificateReduction: 0,
        },
      ],
    }));
  };

  const handleSeal = async () => {
    if (!caseData.caseId) return;
    if (!readiness.isEligibleForSealing) {
      setSealStatus("Resolve every blocker before generating a sealed dossier.");
      return;
    }
    const entitlement = usableEntitlements[0];
    const entitlementId = entitlement?.entitlementId;
    if (!entitlementId) {
      setSealStatus("No case-compatible Preparation Pack release is available.");
      return;
    }
    const currentReleasesCount = entitlement?.releasesCount || 0;
    if (currentReleasesCount > 0 && !correctionReason.trim()) {
      setSealStatus("A correction reason is required for releases after the first release.");
      return;
    }
    if (!sealRequestId.current) sealRequestId.current = crypto.randomUUID();
    setSealing(true);
    setSealStatus("");
    try {
      await persistDraft();
      const response = await sealReport(
        caseData.caseId,
        entitlementId,
        sealRequestId.current,
        correctionReason || undefined
      );
      const reportId = response.report?.reportId;
      if (!reportId) throw new Error("SEALED_REPORT_ID_MISSING");
      router.push(`/cbam/reports/${reportId}`);
    } catch (error) {
      console.error("Sealing failed", error);
      setSealStatus(errorMessage(error));
    } finally {
      setSealing(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">1. Case identity and reporting scope</h2>
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
        {[
          ["importerIdentity.legalName", "Importer legal name", "text"],
          ["exporterIdentity.legalName", "Exporter/operator legal name", "text"],
          ["importerIdentity.eoriNumber", "Declarant EORI number", "text"],
          ["reportingPeriod.year", "Reporting year (e.g. 2025)", "number"],
          ["reportingPeriod.quarter", "Reporting period / quarter (e.g. ANNUAL, Q1-Q4)", "text"],
          ["reportingPeriod.startDate", "Reporting period start date (YYYY-MM-DD)", "date"],
          ["reportingPeriod.endDate", "Reporting period end date (YYYY-MM-DD)", "date"],
        ].map(([path, label, type]) => {
          const parts = path.split(/[.]/);
          const datum = parts.reduce<unknown>((val, part) => (val && typeof val === "object" ? (val as Record<string, unknown>)[part] : undefined), caseData) as InputDatum | null | undefined;
          return <div key={path}><FieldLabel>{label}</FieldLabel><input aria-label={label} type={type} value={datumValue(datum?.value)} onChange={(event) => updateDatum(path, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>;
        })}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">2. Goods, units and allocation</h2><button type="button" onClick={addGood} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface"><Plus className="h-4 w-4" /> Add good</button></div>
      {caseData.goods.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No goods declared.</div>}
      {caseData.goods.map((good, index) => (
        <div key={`good-${index}`} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
          <div><FieldLabel>CN code</FieldLabel><input aria-label={`Good ${index + 1} CN code`} inputMode="numeric" value={datumValue(good?.cnCode?.value)} onChange={(event) => updateDatum(`goods.${index}.cnCode`, { value: event.target.value.replace(/\D/g, "").slice(0, 8) })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
          <div><FieldLabel>CBAM sector</FieldLabel><select aria-label={`Good ${index + 1} sector`} value={good.sector} onChange={(event) => updatePlain(`goods.${index}.sector`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{SECTORS.map((sector) => <option key={sector} value={sector}>{sector.replaceAll("_", " ")}</option>)}</select></div>
          <div><FieldLabel>Production quantity</FieldLabel><input aria-label={`Good ${index + 1} production quantity`} type="number" min="0" step="any" value={datumValue(good?.productionVolume?.value)} onChange={(event) => updateDatum(`goods.${index}.productionVolume`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
          <div><FieldLabel>Production unit</FieldLabel><select aria-label={`Good ${index + 1} production unit`} value={good?.productionVolume?.canonicalUnit || "t"} onChange={(event) => updateDatum(`goods.${index}.productionVolume`, { canonicalUnit: event.target.value as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="t">tonnes</option><option value="kg">kilograms</option></select></div>
          <div><FieldLabel>Shipment / product description</FieldLabel><input aria-label={`Good ${index + 1} shipment description`} value={datumValue(good?.shipmentRecords?.value)} onChange={(event) => updateDatum(`goods.${index}.shipmentRecords`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
          {caseData.goods.length > 1 && <div><FieldLabel>Allocation share (0–1)</FieldLabel><input aria-label={`Good ${index + 1} allocation share`} type="number" min="0" max="1" step="0.000001" value={datumValue(good?.allocationShare?.value ?? null)} onChange={(event) => updateDatum(`goods.${index}.allocationShare`, { value: event.target.value, canonicalUnit: "fraction" })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>}
          <button type="button" onClick={() => removeGood(index)} className="inline-flex items-center gap-2 text-sm text-red-700"><Trash2 className="h-4 w-4" /> Remove good</button>
        </div>
      ))}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6"><h2 className="text-xl font-bold">3. Installation and system boundary</h2><div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
      <div><FieldLabel>Installation name</FieldLabel><input aria-label="Installation name" value={datumValue(caseData?.installation?.name?.value)} onChange={(event) => updateDatum("installation.name", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
      <div><FieldLabel>Installation country</FieldLabel><input aria-label="Installation country" value={datumValue(caseData?.installation?.country?.value)} onChange={(event) => updateDatum("installation.country", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
      <div><FieldLabel>Production route</FieldLabel><input aria-label="Production route" value={datumValue(caseData?.installation?.productionRoute?.value)} onChange={(event) => updateDatum("installation.productionRoute", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
      <div className="md:col-span-2"><FieldLabel>System-boundary statement</FieldLabel><textarea aria-label="System-boundary statement" value={caseData?.installation?.systemBoundaries || ""} onChange={(event) => updatePlain("installation.systemBoundaries", event.target.value)} rows={5} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
    </div></div>
  );

  const emissionInput = (path: "directEmissions" | "electricityConsumed" | "gridEmissionFactor", label: string, unit: UnitCode) => {
    const datum = caseData?.[path];
    return <div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-3">
      <div><FieldLabel>{label}</FieldLabel><input aria-label={label} type="number" min="0" step="any" value={datumValue(datum?.value)} onChange={(event) => updateDatum(path, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
      <div><FieldLabel>Unit</FieldLabel><select aria-label={`${label} unit`} value={datum?.canonicalUnit || unit} onChange={(event) => updateDatum(path, { canonicalUnit: event.target.value as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm"><option value={unit}>{unit}</option></select></div>
      <div><FieldLabel>Source type</FieldLabel><select aria-label={`${label} source type`} value={datum?.sourceType || "PRIMARY"} onChange={(event) => updateDatum(path, { sourceType: event.target.value as InputDatum["sourceType"] })} className="w-full rounded border border-border bg-background p-2 text-sm">{SOURCE_TYPES.map((source) => <option key={source} value={source}>{source}</option>)}</select></div>
    </div>;
  };

  const renderStep4 = () => <div className="space-y-6"><h2 className="text-xl font-bold">4. Direct emissions</h2>{emissionInput("directEmissions", "Total direct emissions", "tCO2e")}</div>;
  const renderStep5 = () => <div className="space-y-6"><h2 className="text-xl font-bold">5. Indirect emissions</h2>{emissionInput("electricityConsumed", "Electricity consumed", "MWh")}{emissionInput("gridEmissionFactor", "Grid emission factor", "tCO2e/MWh")}</div>;

  const renderStep6 = () => (
    <div className="space-y-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">6. Precursors and methodology decisions</h2><button type="button" onClick={addPrecursor} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface"><Plus className="h-4 w-4" /> Add precursor</button></div>
      {caseData.precursors.length === 0 && <button type="button" onClick={() => addMethodologyDecision("PRECURSOR_SCOPE")} className="rounded border border-border bg-surface px-4 py-3 text-sm">Record accepted no-precursor scope decision</button>}
      {caseData.precursors.map((precursor, index) => <div key={`precursor-${index}`} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        {[["name", "Precursor name"], ["countryOfOrigin", "Country of origin"]].map(([field, label]) => <div key={field}><FieldLabel>{label}</FieldLabel><input aria-label={`Precursor ${index + 1} ${label}`} value={datumValue(precursor[field as "name" | "countryOfOrigin"]?.value)} onChange={(event) => updateDatum(`precursors.${index}.${field}`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>)}
        {[["quantity", "Quantity", "t"], ["directEmissions", "Direct emissions", "tCO2e"], ["indirectEmissions", "Indirect emissions", "tCO2e"]].map(([field, label, unit]) => <div key={field}><FieldLabel>{label} ({unit})</FieldLabel><input aria-label={`Precursor ${index + 1} ${label}`} type="number" min="0" step="any" value={datumValue(precursor[field as "quantity" | "directEmissions" | "indirectEmissions"]?.value)} onChange={(event) => updateDatum(`precursors.${index}.${field}`, { value: event.target.value, canonicalUnit: unit as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>)}
        <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, precursors: previous.precursors.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-red-700"><Trash2 className="h-4 w-4" /> Remove precursor</button>
      </div>)}
      {caseData.goods.length > 1 && <button type="button" onClick={() => addMethodologyDecision("GOODS_EMISSIONS_ALLOCATION")} className="rounded border border-border bg-surface px-4 py-3 text-sm">Record accepted allocation methodology</button>}
      <div className="space-y-2">{caseData.methodologyDecisions.map((decision) => <div key={decision.decisionId} className="rounded border border-border bg-neutral-soft p-3 text-sm"><strong>{decision.topic}</strong><p>{decision.selectedMethod}</p><p className="text-xs text-muted">{decision.reviewStatus} · {decision.rulesetVersion}</p></div>)}</div>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-8"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">7. Carbon price and evidence register</h2><button type="button" onClick={addCarbonPriceRecord} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-sm"><Plus className="h-4 w-4" /> Add carbon-price record</button></div>
      {caseData.carbonPriceRecords.map((record, index) => <div key={record.id} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        <div><FieldLabel>Amount paid</FieldLabel><input aria-label={`Carbon price ${index + 1} amount paid`} type="number" min="0" step="any" value={record.amountPaid} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.amountPaid`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
        <div><FieldLabel>Applicable emissions</FieldLabel><input aria-label={`Carbon price ${index + 1} applicable emissions`} type="number" min="0" step="any" value={record.applicableEmissions} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.applicableEmissions`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
        <div><FieldLabel>Currency</FieldLabel><select aria-label={`Carbon price ${index + 1} currency`} value={record.currency} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.currency`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{["EUR", "USD", "GBP", "TRY"].map((currency) => <option key={currency}>{currency}</option>)}</select></div>
        <div><FieldLabel>Legislation reference</FieldLabel><input aria-label={`Carbon price ${index + 1} legislation reference`} value={record.legislationReference} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.legislationReference`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
        <div><FieldLabel>Payment evidence</FieldLabel><select aria-label={`Carbon price ${index + 1} payment evidence`} value={record.proofOfPaymentEvidenceId || ""} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.proofOfPaymentEvidenceId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">Select evidence</option>{caseData.evidenceRegister.map((evidence) => <option key={evidence.evidenceId} value={evidence.evidenceId}>{evidence.fileName}</option>)}</select></div>
      </div>)}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6"><h3 className="font-bold">Upload immutable evidence</h3><div className="grid gap-4 md:grid-cols-2">
        <div><FieldLabel>File</FieldLabel><input aria-label="Evidence file" type="file" accept=".pdf,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} /></div>
        <div><FieldLabel>Document type</FieldLabel><input aria-label="Evidence document type" value={evidenceDocumentType} onChange={(event) => setEvidenceDocumentType(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
        <div><FieldLabel>Issuer</FieldLabel><input aria-label="Evidence issuer" value={evidenceIssuer} onChange={(event) => setEvidenceIssuer(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
        <div><FieldLabel>Issue date</FieldLabel><input aria-label="Evidence issue date" type="date" value={evidenceIssueDate} onChange={(event) => setEvidenceIssueDate(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
        <div><FieldLabel>Linked input</FieldLabel><select aria-label="Evidence linked input" value={evidenceLinkedInput} onChange={(event) => setEvidenceLinkedInput(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{EVIDENCE_LINK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{caseData.goods.flatMap((_, index) => [[`goods.${index}.cnCode`, `Good ${index + 1} CN code`], [`goods.${index}.productionVolume`, `Good ${index + 1} production`], [`goods.${index}.allocationShare`, `Good ${index + 1} allocation`]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}{caseData.precursors.flatMap((_, index) => [[`precursors.${index}.quantity`, `Precursor ${index + 1} quantity`], [`precursors.${index}.directEmissions`, `Precursor ${index + 1} direct emissions`], [`precursors.${index}.indirectEmissions`, `Precursor ${index + 1} indirect emissions`]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div><button type="button" onClick={handleEvidenceUpload} disabled={uploading} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload and register evidence</button><StatusBanner status={evidenceStatus} tone={evidenceStatus.toLowerCase().includes("failed") || evidenceStatus.includes("EVIDENCE_") ? "error" : "warning"} /></div>

      <div className="space-y-3">{caseData.evidenceRegister.map((evidence) => <div key={evidence.evidenceId} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{evidence.fileName}</p><p className="text-xs text-muted">{evidence.documentType} · {evidence.sizeBytes} bytes · {evidence.reviewStatus}/{evidence.supportStatus}/{evidence.malwareScanStatus}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">SHA-256 {evidence.fileHash}</p></div></div><div className="mt-3 flex flex-col gap-2 md:flex-row"><input aria-label={`Review notes for ${evidence.fileName}`} value={reviewNotes[evidence.evidenceId] || ""} onChange={(event) => setReviewNotes((previous) => ({ ...previous, [evidence.evidenceId]: event.target.value }))} placeholder="Internal review note" className="flex-1 rounded border border-border bg-background p-2 text-sm" /><button type="button" disabled={evidence.malwareScanStatus !== "CLEAN"} onClick={() => handleEvidenceReview(evidence.evidenceId, "APPROVED")} className="rounded bg-accent hover:bg-accent-hover px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Approve</button><button type="button" onClick={() => handleEvidenceReview(evidence.evidenceId, "REJECTED")} className="rounded bg-red-700 px-3 py-2 text-xs font-semibold text-white">Reject</button></div>{evidence.malwareScanStatus !== "CLEAN" && <p className="mt-2 text-xs text-accent">Approval is disabled until an administrator records an external malware scan as CLEAN.</p>}</div>)}</div>
    </div>
  );

  const renderStep8 = () => {
    const currentReleasesCount = usableEntitlements[0]?.releasesCount || 0;
    return (
      <div className="space-y-6"><h2 className="text-xl font-bold">8. Verification readiness and dossier generation</h2><div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h3 className="mb-4 flex items-center gap-2 font-bold"><Shield className="h-5 w-5 text-accent" /> Verification readiness</h3>
          <div className={`rounded border p-3 text-sm font-semibold ${readiness.isEligibleForSealing ? "border-accent/30 bg-accent-soft text-accent" : "border-red-300 bg-red-50 text-red-900"}`}>{readiness.status} · {readiness.completenessPercentage}% · {readiness.passedControls}/{readiness.applicableControls} controls passed</div>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{readiness.allGaps.map((gap) => <div key={gap.gapId} className="border-l-2 border-red-500 pl-3 text-xs"><strong>{gap.requirement}</strong><p className="text-muted">{gap.whyItMatters}</p></div>)}</div>
          {currentReleasesCount > 0 && <div className="mt-5"><FieldLabel>Correction Reason (Required for Release {currentReleasesCount + 1})</FieldLabel><textarea aria-label="Correction reason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Describe the corrections made in this release (e.g., corrected CN code, updated precursor emissions)." rows={3} className="w-full rounded border border-border bg-background p-2.5 text-sm" /></div>}
          {usableEntitlements.length === 0 && (
            <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4 text-xs text-foreground">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="font-bold text-accent block text-sm mb-0.5">Preparation Pack Required</span>
                  <p className="text-muted leading-relaxed">
                    Your dossier is ready for verification preparation. Purchase an Exporter Verification Preparation Pack ($149) to seal and download final verifier-preparation deliverables.
                  </p>
                </div>
                <Link
                  href="/credits/buy"
                  className="shrink-0 rounded bg-accent hover:bg-accent-hover px-4 py-2 text-xs font-semibold text-surface transition-colors shadow-sm text-center"
                >
                  Buy Pack — $149
                </Link>
              </div>
            </div>
          )}
          <button type="button" aria-label="Generate sealed dossier" onClick={handleSeal} disabled={sealing || !readiness.isEligibleForSealing || usableEntitlements.length === 0} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-accent p-3 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-40">{sealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Generate sealed dossier</button>
          <StatusBanner status={sealStatus} tone="error" />
          <p className="mt-3 text-xs text-muted">Generation consumes a successful release only after server validation, immutable artifact commit and signature completion.</p>
        </section>
        <section className="rounded-xl border border-border bg-surface p-6"><h3 className="mb-4 flex items-center gap-2 font-bold"><FileCode2 className="h-5 w-5 text-accent" /> Mathematical audit preview</h3>{calculation.error ? <StatusBanner status={calculation.error} tone="warning" /> : <><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted">Total embedded</span><strong className="block">{calculation.result?.totalEmbeddedEmissions} tCO2e</strong></div><div><span className="text-muted">Aggregate intensity</span><strong className="block">{calculation.result?.specificEmbeddedEmissions} tCO2e/t</strong></div><div><span className="text-muted">Allocation total</span><strong className="block">{calculation.result?.allocationShareTotal}</strong></div><div><span className="text-muted">Reconciliation delta</span><strong className="block">{calculation.result?.allocationReconciliationDelta}</strong></div></div><div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{calculation.result?.trace.map((trace) => <div key={trace.calculationId} className="rounded border border-border bg-neutral-soft p-3 font-mono text-xs"><div className="font-bold text-accent">{trace.formulaId}</div><div>{String(trace.outputValue)} {trace.outputUnit}</div><div className="break-all text-[10px] text-muted">{trace.calculationHash}</div></div>)}</div></>}</section>
      </div></div>
    );
  };

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8][currentStep - 1];

  return <main className="min-h-screen bg-background px-4 py-8 pb-32 text-foreground md:px-8"><div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-center"><div><h1 className="text-2xl font-bold">Case workflow</h1><p className="text-sm text-muted">ID: {caseData.caseId || "UNASSIGNED"} · User: {sessionUser.email || sessionUser.uid}</p></div><button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded border border-border bg-neutral-soft px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save draft"}</button></header><StatusBanner status={saveStatus} tone={saveTone} /><nav aria-label="Dossier steps" className="flex gap-3 overflow-x-auto pb-3">{STEPS.map((step) => <button type="button" key={step.id} onClick={() => setCurrentStep(step.id)} className={`min-w-28 rounded-lg border px-3 py-2 text-xs font-bold ${currentStep === step.id ? "border-accent bg-accent text-surface" : "border-border bg-surface text-muted"}`}><span className="block text-sm">{step.id}</span>{step.label}</button>)}</nav><section className="py-4">{stepContent()}</section></div><div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface p-4 shadow-[0_-4px_8px_rgba(0,0,0,0.08)]"><div className="mx-auto flex max-w-6xl items-center justify-between"><button type="button" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={currentStep === 1} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Previous</button><span className="text-sm font-bold text-muted">Step {currentStep} of 8</span><button type="button" onClick={() => setCurrentStep((step) => Math.min(8, step + 1))} disabled={currentStep === 8} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-surface disabled:opacity-40">Next <ArrowRight className="h-4 w-4" /></button></div></div></main>;
}
