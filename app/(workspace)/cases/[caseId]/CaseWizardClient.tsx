"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Eraser,
  FileCode2,
  FileCheck2,
  FileUp,
  LockKeyhole,
  Loader2,
  PackageCheck,
  Plus,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import { DecimalInput } from "@/components/cbam/DecimalInput";
import { FieldHelp } from "@/components/cbam/FieldHelp";
import { UnlockPreparationPackPanel } from "@/components/billing/UnlockPreparationPackPanel";
import { packsUnlockableFromCredits } from "@/lib/billing/credit-contract";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";
import { performDossierCalculations } from "@/lib/cbam/calculator";
import { fieldHelpData, type FieldHelpKey } from "@/lib/cbam/field-help";
import { GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH } from "@/lib/cbam/input-constraints";
import {
  ILLUSTRATIVE_SCENARIO_ID,
  isIllustrativeScenarioActive,
  replaceIllustrativeScenarioWithBlank,
} from "@/lib/cbam/new-case";
import {
  AuditReadyCaseSchema,
  createEmptyInput,
  type AuditReadyCase,
  type EvidenceSupportStatus,
  type GapRecord,
  type InputDatum,
  type UnitCode,
} from "@/lib/cbam/schema";
import { uploadEvidenceFile } from "@/lib/cbam/evidence-upload";
import {
  getAccountOverview,
  getEntitlements,
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

const SEALED_PACKAGE_HIGHLIGHTS = [
  { title: "11 professional PDFs", detail: "Executive report, monitoring plan, calculation annex, readiness assessment and methodology records", icon: FileCheck2 },
  { title: "Verifier workspace", detail: "Controlled XLSX with 14+ worksheets, filters, validations, source links and verifier sign-off", icon: FileCode2 },
  { title: "Evidence assurance", detail: "Immutable evidence copies, field links, issuer/date metadata, malware status and SHA-256 register", icon: Shield },
  { title: "Signed trust chain", detail: "27-component ZIP, canonical manifest, KMS asymmetric signature and immutable release hashes", icon: LockKeyhole },
] as const;

function numeric(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function percentOf(value: string | number | null | undefined, total: string | number | null | undefined): number {
  const denominator = numeric(total);
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, (numeric(value) / denominator) * 100));
}

function gapResolution(gap: GapRecord): { step: number; action: string; evidence: string } {
  const code = String(gap.requiredEvidence || "");
  const requirement = gap.requirement.toLowerCase();
  if (code.includes("SCENARIO")) return { step: 1, action: "Remove the illustrative scenario and enter the real operator and reporting scope.", evidence: "Case-specific records must replace every demonstration value." };
  if (code.includes("EORI") || requirement.includes("eori")) return { step: 1, action: "Enter the active declarant EORI, then upload and link the registration evidence.", evidence: "EORI registration record or importer-issued evidence." };
  if (code.includes("IDENTITY")) return { step: 3, action: "Complete the importer, exporter, installation, country, route and explicit system boundary.", evidence: "Company records, operating permit, monitoring plan and process map." };
  if (code.includes("CN_") || code.includes("PRODUCTION") || code.includes("ALLOCATION") || requirement.includes("good")) return { step: 2, action: "Correct the goods row and reconcile all allocation shares to exactly 1 before linking source records.", evidence: "Customs classification, production ledger and allocation workbook." };
  if (requirement.includes("directemissions") || code.includes("QC_06")) return { step: 4, action: "Enter period-total direct emissions and link the approved monitoring calculation.", evidence: "Fuel/activity ledger, meter/lab records and emissions workbook." };
  if (requirement.includes("electricity") || requirement.includes("gridemissionfactor") || code.includes("QC_07") || code.includes("QC_08")) return { step: 5, action: "Enter electricity and a correctly scaled grid factor, then link each value to approved evidence.", evidence: "Meter/invoice records and the official or supplier-specific factor source with period/version." };
  if (requirement.includes("precursor") || code.includes("PRECURSOR")) return { step: 6, action: "Complete each precursor quantity and emissions field, or document an evidenced no-precursor decision.", evidence: "Bill of materials, mass balance and supplier/operator emissions communication." };
  if (requirement.includes("carbon") || code.includes("CARBON_PRICE")) return { step: 7, action: "Link the carbon-price record to approved proof of assessment and payment, or remove an unsupported deduction.", evidence: "Official assessment, receipt, applicable-emissions reconciliation and rebate documentation." };
  return { step: 7, action: "Upload the source document, link it to the exact input and complete malware and support review.", evidence: "Original source file with issuer, issue date, reporting period and SHA-256 integrity record." };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "The requested operation failed.";
}

function setAtPath<T>(source: T, path: string, updater: (value: unknown) => unknown): T {
  const next = structuredClone(source);
  const parts = path.split(".");
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

function datumValue(value: InputDatum["value"]): string | number {
  return value ?? "";
}

function FieldLabel({ children, helpKey }: { children: React.ReactNode; helpKey: FieldHelpKey }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-foreground">
      <span>{children}</span>
      <FieldHelp field={helpKey} label={String(children)} />
    </div>
  );
}

function StatusBanner({ status, tone = "neutral" }: { status: string; tone?: "neutral" | "success" | "error" | "warning" }) {
  if (!status) return null;
  const classes = tone === "success"
    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
    : tone === "error"
      ? "border-red-300 bg-red-50 text-red-900"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-border bg-neutral-soft text-foreground";
  return <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>{status}</div>;
}

export default function CaseWizardClient({ sessionUser, initialCase, availableEntitlements }: CaseWizardClientProps) {
  const router = useRouter();
  const sealRequestId = useRef<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [caseData, setCaseData] = useState<AuditReadyCase>(() => AuditReadyCaseSchema.parse(initialCase));
  const [entitlementOverride, setEntitlementOverride] = useState<PreparationPackEntitlement[] | null>(null);
  const entitlements = entitlementOverride ?? availableEntitlements;
  const [availableCredits, setAvailableCredits] = useState(0);
  const [saving, setSaving] = useState(false);
  const [clearingScenario, setClearingScenario] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveTone, setSaveTone] = useState<"neutral" | "success" | "error">("neutral");
  const [uploading, setUploading] = useState(false);
  const [evidenceStatus, setEvidenceStatus] = useState("");
  const [sealing, setSealing] = useState(false);
  const [sealStatus, setSealStatus] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceDocumentType, setEvidenceDocumentType] = useState("PRODUCTION_RECORD");
  const [evidenceIssuer, setEvidenceIssuer] = useState("");
  const [evidenceIssueDate, setEvidenceIssueDate] = useState("");
  const [evidenceLinkedInput, setEvidenceLinkedInput] = useState("directEmissions");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [correctionReason, setCorrectionReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getAccountOverview()
      .then((overview) => {
        if (cancelled) return;
        const credits = overview.credits as { availableCredits?: number } | undefined;
        setAvailableCredits(Number(credits?.availableCredits || 0));
      })
      .catch((error) => {
        console.error("Failed to load case credit balance", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const readiness = useMemo(() => assessCaseReadiness(caseData), [caseData]);
  const scenarioActive = useMemo(() => isIllustrativeScenarioActive(caseData), [caseData]);
  const calculation = useMemo(() => {
    try {
      return { result: performDossierCalculations(caseData), error: "" };
    } catch (error) {
      return { result: null, error: errorMessage(error) };
    }
  }, [caseData]);

  const currentReleasesCount = useMemo(() => {
    const entitlement = entitlements.find(
      (e) => e.scopeCaseId === caseData.caseId || e.caseId === caseData.caseId
    );
    return entitlement?.releasesCount || 0;
  }, [entitlements, caseData.caseId]);

  const usableEntitlements = useMemo(() => entitlements.filter((entitlement) => {
    const status = String(entitlement.status || "").toUpperCase();
    const caseId = entitlement.scopeCaseId || entitlement.caseId;
    const caseMatches = !caseId || caseId === caseData.caseId;
    return caseMatches && ["AVAILABLE", "ACTIVE", "PURCHASED"].includes(status);
  }), [entitlements, caseData.caseId]);

  const refreshPackState = async () => {
    const [overview, nextEntitlements] = await Promise.all([
      getAccountOverview(),
      getEntitlements(),
    ]);
    const credits = overview.credits as { availableCredits?: number } | undefined;
    setAvailableCredits(Number(credits?.availableCredits || 0));
    setEntitlementOverride(nextEntitlements);
  };

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
    
    // Deep clone to keep React state immutable
    const cloned = JSON.parse(JSON.stringify(data));
    
    // Automatically align reporting period start/end dates to match the year and quarter
    const yearVal = cloned.reportingPeriod?.year?.value;
    const quarterVal = cloned.reportingPeriod?.quarter?.value;
    if (yearVal && quarterVal && cloned.reportingPeriod) {
      if (!cloned.reportingPeriod.startDate) {
        cloned.reportingPeriod.startDate = { sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", value: "" };
      }
      if (!cloned.reportingPeriod.endDate) {
        cloned.reportingPeriod.endDate = { sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", value: "" };
      }
      
      if (quarterVal === "ANNUAL") {
        cloned.reportingPeriod.startDate.value = `${yearVal}-01-01`;
        cloned.reportingPeriod.endDate.value = `${yearVal}-12-31`;
      } else if (quarterVal === "Q1") {
        cloned.reportingPeriod.startDate.value = `${yearVal}-01-01`;
        cloned.reportingPeriod.endDate.value = `${yearVal}-03-31`;
      } else if (quarterVal === "Q2") {
        cloned.reportingPeriod.startDate.value = `${yearVal}-04-01`;
        cloned.reportingPeriod.endDate.value = `${yearVal}-06-30`;
      } else if (quarterVal === "Q3") {
        cloned.reportingPeriod.startDate.value = `${yearVal}-07-01`;
        cloned.reportingPeriod.endDate.value = `${yearVal}-09-30`;
      } else if (quarterVal === "Q4") {
        cloned.reportingPeriod.startDate.value = `${yearVal}-10-01`;
        cloned.reportingPeriod.endDate.value = `${yearVal}-12-31`;
      }
    }
    
    const parsed = AuditReadyCaseSchema.parse(cloned);
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

  const handleStartBlankCase = async () => {
    if (!window.confirm(
      "Remove every illustrative value from this draft and start with blank fields? This cannot be undone after the blank draft is saved."
    )) return;

    setClearingScenario(true);
    setSaveStatus("");
    try {
      const blank = replaceIllustrativeScenarioWithBlank(caseData, sessionUser.uid);
      await persistDraft(blank);
      setCaseData(blank);
      setSaveTone("success");
      setSaveStatus("Illustrative values were removed. Enter and evidence your case-specific data.");
      setCurrentStep(1);
    } catch (error) {
      console.error("Illustrative scenario removal failed", error);
      setSaveTone("error");
      setSaveStatus(errorMessage(error));
    } finally {
      setClearingScenario(false);
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

  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        alert("Invalid CSV: The file must contain a header row and at least one data row.");
        return;
      }
      
      const newPrecursors: Array<AuditReadyCase["precursors"][number]> = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(",").map(item => item.trim().replace(/^["']|["']$/g, ""));
        if (parts.length < 5) continue;
        
        const [name, country, quantity, direct, indirect] = parts;
        if (!name || !country) continue;
        
        const qtyVal = parseFloat(quantity);
        const directVal = parseFloat(direct);
        const indirectVal = parseFloat(indirect);
        
        newPrecursors.push({
          name: { value: name, sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
          quantity: { value: isNaN(qtyVal) ? null : qtyVal, canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
          directEmissions: { value: isNaN(directVal) ? null : directVal, canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
          indirectEmissions: { value: isNaN(indirectVal) ? null : indirectVal, canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
          countryOfOrigin: { value: country, sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
        });
      }
      
      if (newPrecursors.length === 0) {
        alert("No valid rows matched the format (Name, Country, Quantity, DirectEmissions, IndirectEmissions).");
        return;
      }
      
      setCaseData((prev) => ({
        ...prev,
        precursors: [...prev.precursors, ...newPrecursors],
      }));
      
      alert(`Successfully imported ${newPrecursors.length} precursors!`);
      event.target.value = "";
    };
    reader.readAsText(file);
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
    if (currentReleasesCount > 0 && (!correctionReason || correctionReason.trim().length < 10)) {
      setSealStatus("Correction reason is required and must be at least 10 characters long.");
      return;
    }
    const entitlementId = usableEntitlements[0]?.entitlementId;
    if (!entitlementId) {
      setSealStatus("No case-compatible Preparation Pack release is available.");
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
      <div>
        <h2 className="text-xl font-bold">1. Case setup</h2>
        <p className="mt-1 text-sm text-muted">Define the legal identity of the importer and exporter, and select the reporting calendar year and period.</p>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
        {[
          ["importerIdentity.legalName", "Importer legal name", "text", "importerLegalName"],
          ["exporterIdentity.legalName", "Exporter/operator legal name", "text", "exporterLegalName"],
          ["importerIdentity.eoriNumber", "Declarant EORI number", "text", "declarantEori"],
          ["reportingPeriod.year", "Reporting year", "number", "reportingYear"],
          ["reportingPeriod.quarter", "Reporting period / quarter", "text", "reportingQuarter"],
        ].map(([path, label, type, helpKey]) => {
          const parts = path.split(".");
          const datum = parts.reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], caseData) as InputDatum;
          return (
            <div key={path}>
              <FieldLabel helpKey={helpKey as FieldHelpKey}>{label}</FieldLabel>
              <input aria-label={label} type={type} value={datumValue(datum.value)} onChange={(event) => updateDatum(path, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
              <p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData[helpKey as FieldHelpKey]?.source}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">2. Goods, units and allocation</h2>
        <p className="mt-1 text-sm text-muted">Add the Combined Nomenclature (CN) codes of the goods, specify production quantities, and allocate installation-level emissions if declaring multiple goods.</p>
      </div>
      {caseData.goods.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No goods declared.</div>}
      {caseData.goods.map((good, index) => (
        <div key={`good-${index}`} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
          <div><FieldLabel helpKey="cnCode">CN code</FieldLabel><input aria-label={`Good ${index + 1} CN code`} inputMode="numeric" value={datumValue(good.cnCode.value)} onChange={(event) => updateDatum(`goods.${index}.cnCode`, { value: event.target.value.replace(/\D/g, "").slice(0, 8) })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.cnCode.source}</p></div>
          <div><FieldLabel helpKey="cbamSector">CBAM sector</FieldLabel><select aria-label={`Good ${index + 1} sector`} value={good.sector} onChange={(event) => updatePlain(`goods.${index}.sector`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{SECTORS.map((sector) => <option key={sector} value={sector}>{sector.replaceAll("_", " ")}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.cbamSector.source}</p></div>
          <div><FieldLabel helpKey="productionQuantity">Production quantity</FieldLabel><DecimalInput ariaLabel={`Good ${index + 1} production quantity`} min="0" value={datumValue(good.productionVolume.value)} onValueChange={(value) => updateDatum(`goods.${index}.productionVolume`, { value })} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionQuantity.source}</p></div>
          <div><FieldLabel helpKey="productionUnit">Production unit</FieldLabel><select aria-label={`Good ${index + 1} production unit`} value={good.productionVolume.canonicalUnit || "t"} onChange={(event) => updateDatum(`goods.${index}.productionVolume`, { canonicalUnit: event.target.value as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="t">tonnes</option><option value="kg">kilograms</option></select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionUnit.source}</p></div>
          <div><FieldLabel helpKey="shipmentDescription">Shipment / product description</FieldLabel><input aria-label={`Good ${index + 1} shipment description`} value={datumValue(good.shipmentRecords.value)} onChange={(event) => updateDatum(`goods.${index}.shipmentRecords`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.shipmentDescription.source}</p></div>
          {caseData.goods.length > 1 && <div><FieldLabel helpKey="allocationShare">Allocation share (0–1)</FieldLabel><DecimalInput ariaLabel={`Good ${index + 1} allocation share`} min="0" max="1" value={datumValue(good.allocationShare?.value ?? null)} onValueChange={(value) => updateDatum(`goods.${index}.allocationShare`, { value, canonicalUnit: "fraction" })} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.allocationShare.source}</p></div>}
          <button type="button" onClick={() => removeGood(index)} className="inline-flex items-center gap-2 text-sm text-red-700 md:col-span-2"><Trash2 className="h-4 w-4" /> Remove good</button>
        </div>
      ))}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">3. Installation and system boundary</h2>
        <p className="mt-1 text-sm text-muted">Specify the manufacturing facility details, geographic location, production technology route, and write a system-boundary statement.</p>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
        <div><FieldLabel helpKey="installationName">Installation name</FieldLabel><input aria-label="Installation name" value={datumValue(caseData.installation.name.value)} onChange={(event) => updateDatum("installation.name", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.installationName.source}</p></div>
        <div><FieldLabel helpKey="installationCountry">Installation country</FieldLabel><input aria-label="Installation country" value={datumValue(caseData.installation.country.value)} onChange={(event) => updateDatum("installation.country", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.installationCountry.source}</p></div>
        <div><FieldLabel helpKey="productionRoute">Production route</FieldLabel><input aria-label="Production route" value={datumValue(caseData.installation.productionRoute.value)} onChange={(event) => updateDatum("installation.productionRoute", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionRoute.source}</p></div>
        <div className="md:col-span-2"><FieldLabel helpKey="systemBoundary">System-boundary statement</FieldLabel><textarea aria-label="System-boundary statement" value={caseData.installation.systemBoundaries || ""} onChange={(event) => updatePlain("installation.systemBoundaries", event.target.value)} rows={5} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.systemBoundary.source}</p></div>
      </div>
    </div>
  );

  const emissionInput = (
    path: "directEmissions" | "electricityConsumed" | "gridEmissionFactor",
    label: string,
    unit: UnitCode,
    helpKey: "directEmissions" | "electricityConsumed" | "gridEmissionFactor"
  ) => {
    const datum = caseData[path];
    const isGridFactor = path === "gridEmissionFactor";
    return <div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-3">
      <div><FieldLabel helpKey={helpKey}>{label}</FieldLabel><DecimalInput ariaLabel={label} min="0" max={isGridFactor ? GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH : undefined} placeholder={isGridFactor ? "0.4344" : undefined} value={datumValue(datum.value)} onValueChange={(value) => updateDatum(path, { value })} />{isGridFactor && Number(datum.value) > Number(GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH) && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">Value exceeds 5 tCO2e/MWh. Check the source unit and decimal separator before continuing.</p>}<p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData[helpKey]?.source}</p></div>
      <div><FieldLabel helpKey="emissionsUnit">Unit</FieldLabel><select aria-label={`${label} unit`} value={datum.canonicalUnit || unit} onChange={(event) => updateDatum(path, { canonicalUnit: event.target.value as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm"><option value={unit}>{unit}</option></select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.emissionsUnit.source}</p></div>
      <div><FieldLabel helpKey="sourceType">Source type</FieldLabel><select aria-label={`${label} source type`} value={datum.sourceType} onChange={(event) => updateDatum(path, { sourceType: event.target.value as InputDatum["sourceType"] })} className="w-full rounded border border-border bg-background p-2 text-sm">{SOURCE_TYPES.map((source) => <option key={source} value={source}>{source}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.sourceType.source}</p></div>
    </div>;
  };

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">4. Direct emissions</h2>
        <p className="mt-1 text-sm text-muted">Enter the total direct greenhouse gas emissions (tCO2e) generated inside the installation boundary for the reporting period.</p>
      </div>
      {emissionInput("directEmissions", "Total direct emissions", "tCO2e", "directEmissions")}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">5. Indirect emissions</h2>
        <p className="mt-1 text-sm text-muted">Report total electricity consumed by production processes (MWh) and the grid emission factor (tCO2e/MWh) applied.</p>
      </div>
      {emissionInput("electricityConsumed", "Electricity consumed", "MWh", "electricityConsumed")}
      {emissionInput("gridEmissionFactor", "Grid emission factor", "tCO2e/MWh", "gridEmissionFactor")}
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">6. Precursors and methodology decisions</h2>
        <p className="mt-1 text-sm text-muted">Declare embedded emissions from precursor materials or record a methodology decision confirming the absence of precursors. You can import precursor records via CSV.</p>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Precursors</h3>
        <div className="flex items-center gap-3">
          <div className="group relative">
            <label className="inline-flex items-center gap-2 rounded border border-border bg-neutral-soft px-4 py-2 text-sm font-semibold text-foreground cursor-pointer hover:bg-border/30">
              <FileUp className="h-4 w-4" /> Import CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvImport}
              />
            </label>
            <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-border bg-surface p-3 text-xs text-muted shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50 leading-relaxed">
              <strong>CSV Format (with header):</strong><br />
              <code className="block bg-neutral-soft p-1 rounded font-mono my-1 overflow-x-auto text-[10px]">
                Name,Country,Quantity,DirectEmissions,IndirectEmissions
              </code>
              <em>Example:</em> Steel Billets,TR,120.5,23.4,12.1
            </div>
          </div>
          <button type="button" onClick={addPrecursor} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface">
            <Plus className="h-4 w-4" /> Add precursor
          </button>
        </div>
      </div>
      {caseData.precursors.length === 0 && <button type="button" onClick={() => addMethodologyDecision("PRECURSOR_SCOPE")} className="rounded border border-border bg-surface px-4 py-3 text-sm">Record accepted no-precursor scope decision</button>}
      {caseData.precursors.map((precursor, index) => <div key={`precursor-${index}`} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        {[["name", "Precursor name", "precursorName"], ["countryOfOrigin", "Country of origin", "precursorCountry"]].map(([field, label, helpKey]) => <div key={field}><FieldLabel helpKey={helpKey as FieldHelpKey}>{label}</FieldLabel><input aria-label={`Precursor ${index + 1} ${label}`} value={datumValue(precursor[field as "name" | "countryOfOrigin"].value)} onChange={(event) => updateDatum(`precursors.${index}.${field}`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData[helpKey as FieldHelpKey]?.source}</p></div>)}
        {[["quantity", "Quantity", "t", "precursorQuantity"], ["directEmissions", "Direct emissions", "tCO2e", "precursorDirectEmissions"], ["indirectEmissions", "Indirect emissions", "tCO2e", "precursorIndirectEmissions"]].map(([field, label, unit, helpKey]) => <div key={field}><FieldLabel helpKey={helpKey as FieldHelpKey}>{label} ({unit})</FieldLabel><DecimalInput ariaLabel={`Precursor ${index + 1} ${label}`} min="0" value={datumValue(precursor[field as "quantity" | "directEmissions" | "indirectEmissions"].value)} onValueChange={(value) => updateDatum(`precursors.${index}.${field}`, { value, canonicalUnit: unit as UnitCode })} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData[helpKey as FieldHelpKey]?.source}</p></div>)}
        <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, precursors: previous.precursors.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-red-700 md:col-span-2"><Trash2 className="h-4 w-4" /> Remove precursor</button>
      </div>)}
      {caseData.goods.length > 1 && <button type="button" onClick={() => addMethodologyDecision("GOODS_EMISSIONS_ALLOCATION")} className="rounded border border-border bg-surface px-4 py-3 text-sm">Record accepted allocation methodology</button>}
      <div className="space-y-2">{caseData.methodologyDecisions.map((decision) => <div key={decision.decisionId} className="rounded border border-border bg-neutral-soft p-3 text-sm"><strong>{decision.topic}</strong><p>{decision.selectedMethod}</p><p className="text-xs text-muted">{decision.reviewStatus} · {decision.rulesetVersion}</p></div>)}</div>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">7. Carbon price and evidence register</h2>
        <p className="mt-1 text-sm text-muted">Record any carbon price paid in the country of origin, upload supporting files, and link them to inputs to construct a digital audit trail.</p>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Carbon price records</h3>
        <button type="button" onClick={addCarbonPriceRecord} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-sm"><Plus className="h-4 w-4" /> Add carbon-price record</button>
      </div>
      {caseData.carbonPriceRecords.map((record, index) => <div key={record.id} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        <div><FieldLabel helpKey="carbonPriceAmountPaid">Amount paid</FieldLabel><DecimalInput ariaLabel={`Carbon price ${index + 1} amount paid`} min="0" value={record.amountPaid} onValueChange={(value) => updatePlain(`carbonPriceRecords.${index}.amountPaid`, value)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceAmountPaid.source}</p></div>
        <div><FieldLabel helpKey="carbonPriceApplicableEmissions">Applicable emissions</FieldLabel><DecimalInput ariaLabel={`Carbon price ${index + 1} applicable emissions`} min="0" value={record.applicableEmissions} onValueChange={(value) => updatePlain(`carbonPriceRecords.${index}.applicableEmissions`, value)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceApplicableEmissions.source}</p></div>
        <div><FieldLabel helpKey="carbonPriceCurrency">Currency</FieldLabel><select aria-label={`Carbon price ${index + 1} currency`} value={record.currency} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.currency`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{["EUR", "USD", "GBP", "TRY"].map((currency) => <option key={currency}>{currency}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceCurrency.source}</p></div>
        <div><FieldLabel helpKey="legislationReference">Legislation reference</FieldLabel><input aria-label={`Carbon price ${index + 1} legislation reference`} value={record.legislationReference} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.legislationReference`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.legislationReference.source}</p></div>
        <div className="md:col-span-2"><FieldLabel helpKey="paymentEvidence">Payment evidence</FieldLabel><select aria-label={`Carbon price ${index + 1} payment evidence`} value={record.proofOfPaymentEvidenceId || ""} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.proofOfPaymentEvidenceId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">Select evidence</option>{caseData.evidenceRegister.map((evidence) => <option key={evidence.evidenceId} value={evidence.evidenceId}>{evidence.fileName}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.paymentEvidence.source}</p></div>
        <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, carbonPriceRecords: previous.carbonPriceRecords.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-red-700 md:col-span-2"><Trash2 className="h-4 w-4" /> Remove carbon-price record</button>
      </div>)}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6"><h3 className="font-bold">Upload immutable evidence</h3><div className="grid gap-4 md:grid-cols-2">
        <div><FieldLabel helpKey="evidenceFile">File</FieldLabel><input aria-label="Evidence file" type="file" accept=".pdf,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceFile.source}</p></div>
        <div><FieldLabel helpKey="evidenceDocumentType">Document type</FieldLabel><input aria-label="Evidence document type" value={evidenceDocumentType} onChange={(event) => setEvidenceDocumentType(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceDocumentType.source}</p></div>
        <div><FieldLabel helpKey="evidenceIssuer">Issuer</FieldLabel><input aria-label="Evidence issuer" value={evidenceIssuer} onChange={(event) => setEvidenceIssuer(event.target.value)} placeholder="Example: electricity supplier or installation operator" className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceIssuer.source}</p></div>
        <div><FieldLabel helpKey="evidenceIssueDate">Issue date</FieldLabel><input aria-label="Evidence issue date" type="date" value={evidenceIssueDate} onChange={(event) => setEvidenceIssueDate(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceIssueDate.source}</p></div>
        <div className="md:col-span-2"><FieldLabel helpKey="evidenceLinkedInput">Linked input</FieldLabel><select aria-label="Evidence linked input" value={evidenceLinkedInput} onChange={(event) => setEvidenceLinkedInput(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{EVIDENCE_LINK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{caseData.goods.flatMap((_, index) => [[`goods.${index}.cnCode`, `Good ${index + 1} CN code`], [`goods.${index}.productionVolume`, `Good ${index + 1} production`], [`goods.${index}.allocationShare`, `Good ${index + 1} allocation`]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}{caseData.precursors.flatMap((_, index) => [[`precursors.${index}.quantity`, `Precursor ${index + 1} quantity`], [`precursors.${index}.directEmissions`, `Precursor ${index + 1} direct emissions`], [`precursors.${index}.indirectEmissions`, `Precursor ${index + 1} indirect emissions`]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceLinkedInput.source}</p></div>
      </div><button type="button" onClick={handleEvidenceUpload} disabled={uploading} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload and register evidence</button><StatusBanner status={evidenceStatus} tone={evidenceStatus.toLowerCase().includes("failed") || evidenceStatus.includes("EVIDENCE_") ? "error" : "warning"} /></div>

      <div className="space-y-3">{caseData.evidenceRegister.map((evidence) => <div key={evidence.evidenceId} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{evidence.fileName}</p><p className="text-xs text-muted">{evidence.documentType} · {evidence.sizeBytes} bytes · {evidence.reviewStatus}/{evidence.supportStatus}/{evidence.malwareScanStatus}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">SHA-256 {evidence.fileHash}</p></div></div><div className="mt-3"><FieldLabel helpKey="evidenceReviewNotes">Internal review note</FieldLabel><div className="flex flex-col gap-2 md:flex-row"><input aria-label={`Review notes for ${evidence.fileName}`} value={reviewNotes[evidence.evidenceId] || ""} onChange={(event) => setReviewNotes((previous) => ({ ...previous, [evidence.evidenceId]: event.target.value }))} placeholder="Internal review note" className="flex-1 rounded border border-border bg-background p-2 text-sm" /><button type="button" disabled={evidence.malwareScanStatus !== "CLEAN"} onClick={() => handleEvidenceReview(evidence.evidenceId, "APPROVED")} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Approve</button><button type="button" onClick={() => handleEvidenceReview(evidence.evidenceId, "REJECTED")} className="rounded bg-red-700 px-3 py-2 text-xs font-semibold text-white">Reject</button></div></div>{evidence.malwareScanStatus !== "CLEAN" && <p className="mt-2 text-xs text-amber-800">Approval is disabled until an administrator records an external malware scan as CLEAN.</p>}</div>)}</div>
    </div>
  );

  const renderStep8 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">8. Verification readiness and dossier generation</h2>
        <p className="mt-1 text-sm text-muted">Review the automated quality controls, inspect the mathematical audit trace, and generate the final sealed verifier package.</p>
      </div>
      {scenarioActive && calculation.result && (
        <section className="rounded-xl border-2 border-blue-300 bg-blue-50 p-6 text-blue-950" aria-label="Illustrative scenario report">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em]">Illustrative scenario · Not for submission</p>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-bold"><BookOpenCheck className="h-5 w-5" /> Scenario report</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed">
                This report is calculated from the example values prefilled across all eight steps. It demonstrates the workflow and expected output structure; it is not verified evidence and cannot be sealed.
              </p>
            </div>
            <span className="rounded bg-blue-900 px-3 py-1 font-mono text-[10px] text-white">{ILLUSTRATIVE_SCENARIO_ID}</span>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Installation</dt><dd className="font-semibold">{String(caseData.installation.name.value)}</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Reporting period</dt><dd className="font-semibold">{String(caseData.reportingPeriod.year.value)} · {String(caseData.reportingPeriod.quarter.value)}</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Production</dt><dd className="font-semibold">{calculation.result.productionVolume} t</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Electricity consumed</dt><dd className="font-semibold">{String(caseData.electricityConsumed.value)} MWh</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Grid factor</dt><dd className="font-semibold">{String(caseData.gridEmissionFactor.value)} tCO2e/MWh</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Direct emissions</dt><dd className="font-semibold">{calculation.result.totalDirectEmissions} tCO2e</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Indirect emissions</dt><dd className="font-semibold">{calculation.result.totalIndirectEmissions} tCO2e</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Precursor emissions</dt><dd className="font-semibold">{calculation.result.totalPrecursorEmissions} tCO2e</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Total embedded</dt><dd className="font-semibold">{calculation.result.totalEmbeddedEmissions} tCO2e</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Aggregate intensity</dt><dd className="font-semibold">{calculation.result.specificEmbeddedEmissions} tCO2e/t</dd></div>
            <div className="rounded border border-blue-200 bg-white p-3"><dt className="text-xs text-blue-700">Illustrative carbon price</dt><dd className="font-semibold">{String(caseData.carbonPriceRecords[0]?.amountPaid ?? "—")} {caseData.carbonPriceRecords[0]?.currency ?? ""}</dd></div>
          </dl>
          <div className="mt-5 overflow-x-auto rounded border border-blue-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-blue-200 bg-blue-100 text-xs uppercase"><tr><th className="p-3">CN code</th><th className="p-3">Production</th><th className="p-3">Allocation</th><th className="p-3">Allocated emissions</th><th className="p-3">Intensity</th></tr></thead>
              <tbody>{calculation.result.goods.map((good) => <tr key={good.goodIndex} className="border-b border-blue-100 last:border-0"><td className="p-3 font-mono">{good.cnCode}</td><td className="p-3">{good.productionVolume} t</td><td className="p-3">{good.allocationShare}</td><td className="p-3">{good.allocatedEmbeddedEmissions} tCO2e</td><td className="p-3">{good.specificEmbeddedEmissions} tCO2e/t</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-blue-800">
            Verification remains intentionally blocked until the illustrative scenario is removed and every material input is supported by approved, malware-clean evidence.
          </p>
        </section>
      )}
      <section className="rounded-xl border border-slate-300 bg-slate-950 p-6 text-white shadow-sm" aria-label="Sealed package deliverables">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Successful sealed release</p>
            <h3 className="mt-1 flex items-center gap-2 text-xl font-bold"><PackageCheck className="h-6 w-6" /> What the Preparation Pack actually delivers</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">The blue scenario above is a free workflow demonstration. A paid release is created only from case-specific data after every preparation control passes and produces a verifier-facing, immutable package.</p>
          </div>
          <span className="shrink-0 rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold">27 controlled components</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {SEALED_PACKAGE_HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return <article key={item.title} className="rounded-lg border border-slate-700 bg-slate-900 p-4"><Icon className="h-5 w-5 text-orange-300" /><h4 className="mt-3 text-sm font-bold">{item.title}</h4><p className="mt-1 text-xs leading-relaxed text-slate-300">{item.detail}</p></article>;
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-400">Professional boundary: CBAMValid prepares the operator dossier and evidence chain. Only an appropriately accredited independent verifier can issue a verification opinion.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h3 className="flex items-center gap-2 font-bold"><Shield className="h-5 w-5 text-accent" /> Verification readiness</h3>
          <div className={`mt-4 rounded border p-4 ${readiness.isEligibleForSealing ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}>
            <div className="flex items-center justify-between gap-4 text-sm font-semibold"><span>{readiness.status.replaceAll("_", " ")}</span><span>{readiness.completenessPercentage}%</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className={`h-full rounded-full ${readiness.isEligibleForSealing ? "bg-emerald-700" : "bg-red-700"}`} style={{ width: `${readiness.completenessPercentage}%` }} /></div>
            <p className="mt-2 text-xs">{readiness.passedControls}/{readiness.applicableControls} applicable controls passed · {readiness.criticalBlockers.length} blocker(s)</p>
          </div>

          {readiness.allGaps.length > 0 ? (
            <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1" aria-label="Readiness remediation plan">
              {readiness.allGaps.map((gap) => {
                const resolution = gapResolution(gap);
                return (
                  <article key={gap.gapId} className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-950">
                    <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" /><div><h4 className="font-bold">{gap.requirement}</h4><p className="mt-1 leading-relaxed text-red-900">{gap.whyItMatters}</p></div></div>
                    <div className="mt-3 rounded border border-red-200 bg-white/70 p-3"><p><strong>How to fix:</strong> {resolution.action}</p><p className="mt-1"><strong>Evidence:</strong> {resolution.evidence}</p></div>
                    <button type="button" onClick={() => setCurrentStep(resolution.step)} className="mt-3 inline-flex items-center gap-1 font-semibold text-red-800 underline underline-offset-2">Fix in step {resolution.step} <ArrowRight className="h-3 w-3" /></button>
                  </article>
                );
              })}
            </div>
          ) : <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mb-2 h-5 w-5" />Every automated preparation control has passed. The independent verifier status remains separate.</div>}

          {currentReleasesCount > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <FieldLabel helpKey="correctionReason">Correction Reason (Required for Release {currentReleasesCount + 1})</FieldLabel>
              <textarea
                aria-label="Correction reason"
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                placeholder="Describe the corrections made in this release (e.g., corrected CN code, updated precursor emissions)."
                rows={3}
                className="w-full rounded border border-border bg-background p-2.5 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.correctionReason.source}</p>
            </div>
          )}

          {usableEntitlements.length === 0 && packsUnlockableFromCredits(availableCredits) > 0 ? (
            <div className="mt-5">
              <UnlockPreparationPackPanel
                availableCredits={availableCredits}
                hasActivePack={false}
                compact
                onUnlocked={async () => {
                  await refreshPackState();
                  setSealStatus("");
                }}
              />
            </div>
          ) : null}

          {readiness.isEligibleForSealing ? (
            <button type="button" aria-label="Generate sealed dossier" onClick={handleSeal} disabled={sealing || usableEntitlements.length === 0} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-accent p-3 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-40">{sealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Generate sealed dossier</button>
          ) : (
            <button type="button" onClick={() => setCurrentStep(scenarioActive ? 1 : 7)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-accent p-3 text-sm font-semibold text-surface"><FileUp className="h-4 w-4" /> {scenarioActive ? "Replace demo with case data" : "Resolve evidence blockers"}</button>
          )}
          {usableEntitlements.length === 0 && packsUnlockableFromCredits(availableCredits) === 0 ? (
            <p className="mt-3 text-xs text-muted">
              No active Preparation Pack remains. Purchase a pack or unlock one from account credits on the Account page.
            </p>
          ) : null}
          <StatusBanner status={sealStatus} tone="error" />
          <p className="mt-3 text-xs text-muted">A release is consumed only after server validation, immutable artifact commit and KMS signature completion. Failed or blocked attempts consume no release.</p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6">
          <h3 className="flex items-center gap-2 font-bold"><FileCode2 className="h-5 w-5 text-accent" /> Mathematical audit and emissions flow</h3>
          {calculation.error ? <div className="mt-4"><StatusBanner status={calculation.error} tone="warning" /></div> : <>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted">Total embedded</span><strong className="block">{calculation.result?.totalEmbeddedEmissions} tCO2e</strong></div><div><span className="text-muted">Aggregate intensity</span><strong className="block">{calculation.result?.specificEmbeddedEmissions} tCO2e/t</strong></div><div><span className="text-muted">Allocation total</span><strong className="block">{calculation.result?.allocationShareTotal}</strong></div><div><span className="text-muted">Reconciliation delta</span><strong className="block">{calculation.result?.allocationReconciliationDelta}</strong></div></div>
            {calculation.result && numeric(calculation.result.totalEmbeddedEmissions) > 0 && <div className="mt-5 rounded-lg border border-border bg-neutral-soft p-4" aria-label="Emissions composition chart"><div className="flex items-center justify-between text-xs"><strong>Emissions composition</strong><span className="text-muted">tCO2e</span></div><div className="mt-3 flex h-8 overflow-hidden rounded-md bg-slate-200" title="Direct, electricity and precursor emissions"><div className="bg-orange-700" style={{ width: `${percentOf(calculation.result.installationDirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} /><div className="bg-blue-700" style={{ width: `${percentOf(calculation.result.electricityIndirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} /><div className="bg-orange-400" style={{ width: `${percentOf(calculation.result.precursorDirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} /><div className="bg-blue-400" style={{ width: `${percentOf(calculation.result.precursorIndirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} /></div><div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2"><span><i className="mr-2 inline-block h-2 w-2 bg-orange-700" />Installation direct {calculation.result.installationDirectEmissions}</span><span><i className="mr-2 inline-block h-2 w-2 bg-blue-700" />Electricity indirect {calculation.result.electricityIndirectEmissions}</span><span><i className="mr-2 inline-block h-2 w-2 bg-orange-400" />Precursor direct {calculation.result.precursorDirectEmissions}</span><span><i className="mr-2 inline-block h-2 w-2 bg-blue-400" />Precursor indirect {calculation.result.precursorIndirectEmissions}</span></div></div>}
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{calculation.result?.trace.map((trace) => <div key={trace.calculationId} className="rounded border border-border bg-neutral-soft p-3 font-mono text-xs"><div className="font-bold text-accent">{trace.formulaId}</div><div>{String(trace.outputValue)} {trace.outputUnit}</div><div className="break-all text-[10px] text-muted">SHA-256 {trace.calculationHash}</div></div>)}</div>
          </>}
        </section>
      </div>
    </div>
  );

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8][currentStep - 1];

  return <main className="min-h-screen bg-background px-4 py-8 pb-32 text-foreground md:px-8"><div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-center"><div><h1 className="text-2xl font-bold">Case workflow</h1><p className="text-sm text-muted">ID: {caseData.caseId || "UNASSIGNED"} · User: {sessionUser.email || sessionUser.uid}</p></div><button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded border border-border bg-neutral-soft px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save draft"}</button></header>{scenarioActive && <aside className="flex flex-col justify-between gap-4 rounded-xl border-2 border-blue-300 bg-blue-50 p-5 text-blue-950 md:flex-row md:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.16em]">Illustrative scenario active</p><p className="mt-1 max-w-3xl text-sm leading-relaxed">Every step is prefilled with a coherent steel-export example. Review the inputs, open the field guidance, and inspect the calculated scenario report in step 8. These values are not evidence and cannot be sealed.</p></div><button type="button" onClick={handleStartBlankCase} disabled={clearingScenario} className="inline-flex shrink-0 items-center justify-center gap-2 rounded border border-blue-800 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50">{clearingScenario ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />} {clearingScenario ? "Removing…" : "Start with blank case"}</button></aside>}<div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 leading-relaxed print:hidden flex gap-3 items-start"><Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" /><div className="space-y-1"><strong>Regulatory Disclaimer:</strong> This platform generates an exporter-prepared verification dossier to streamline independent audit preparation. It is <strong>NOT</strong> an official European Commission verification opinion and does not substitute for independent verification by an EU accredited body.</div></div><StatusBanner status={saveStatus} tone={saveTone} /><nav aria-label="Dossier steps" className="flex gap-3 overflow-x-auto pb-3">{STEPS.map((step) => <button type="button" key={step.id} onClick={() => setCurrentStep(step.id)} className={`min-w-28 rounded-lg border px-3 py-2 text-xs font-bold ${currentStep === step.id ? "border-accent bg-accent text-surface" : "border-border bg-surface text-muted"}`}><span className="block text-sm">{step.id}</span>{step.label}</button>)}</nav><section className="py-4">{stepContent()}</section></div><div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface p-4 shadow-[0_-4px_8px_rgba(0,0,0,0.08)]"><div className="mx-auto flex max-w-6xl items-center justify-between"><button type="button" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={currentStep === 1} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Previous</button><span className="text-sm font-bold text-muted">Step {currentStep} of 8</span><button type="button" onClick={() => setCurrentStep((step) => Math.min(8, step + 1))} disabled={currentStep === 8} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-surface disabled:opacity-40">Next <ArrowRight className="h-4 w-4" /></button></div></div></main>;
}
