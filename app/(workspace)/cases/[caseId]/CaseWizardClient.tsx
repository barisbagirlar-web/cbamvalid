"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { WorkingFileJourneyStrip } from "@/components/cbam/WorkingFileJourneyStrip";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
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
  deleteEvidence,
  reviewEvidence,
  getCase,
  saveCase,
  sealReport,
  type CaseWorkspace,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";

interface CaseWizardClientProps {
  sessionUser: { uid: string; email: string };
  initialCase: CaseWorkspace;
  availableEntitlements: PreparationPackEntitlement[];
}

const STEPS = [
  { id: 1, label: "Who and where" },
  { id: 2, label: "What you sell" },
  { id: 3, label: "How you monitor it" },
  { id: 4, label: "Direct emissions" },
  { id: 5, label: "Electricity" },
  { id: 6, label: "Bought inputs" },
  { id: 7, label: "Proof documents" },
  { id: 8, label: "Fix, lock & download" },
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
  if (code.includes("QC_13") || code.includes("PRODUCTION_PROCESS") || requirement.includes("production process")) return { step: 3, action: "Add each production process, attribute direct and indirect emissions, and link the goods indexes they produce.", evidence: "Monitoring plan process map and process-level attribution workbook." };
  if (code.includes("QC_14") || code.includes("SOURCE_STREAM") || requirement.includes("source stream")) return { step: 3, action: "Complete source streams with meter links, calibration evidence and bounded uncertainty/tier values covering the reporting period.", evidence: "Source-stream register and APPROVED calibration certificate." };
  if (code.includes("QC_15") || code.includes("EMISSION_SOURCE") || requirement.includes("emission source")) return { step: 3, action: "Add emission sources and link them to existing process and stream IDs where applicable.", evidence: "Emission-source register in the monitoring plan." };
  if (code.includes("QC_16") || code.includes("METER") || requirement.includes("meter")) return { step: 3, action: "Add meters with calibration dates covering the reporting period and link APPROVED+SUPPORTED+CLEAN calibration evidence.", evidence: "Accredited calibration certificates and instrument inventory." };
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
    ? "border-forest-light bg-forest-pale text-forest"
    : tone === "error"
      ? "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-status-blocked"
      : tone === "warning"
        ? "border-status-warning/40 bg-[color:var(--status-warning-soft)] text-status-warning"
        : "border-border bg-neutral-soft text-foreground";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>{status}</div>;
}

export default function CaseWizardClient({ sessionUser, initialCase, availableEntitlements }: CaseWizardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sealRequestId = useRef<string | null>(null);
  const initialData = useMemo(() => AuditReadyCaseSchema.parse(initialCase), [initialCase]);
  const revisionRef = useRef(initialCase.revision);
  const [revision, setRevision] = useState(initialCase.revision);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialData));
  const [caseData, setCaseData] = useState<AuditReadyCase>(() => AuditReadyCaseSchema.parse(initialCase));
  const entitlements = availableEntitlements;
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
  const [recoveryDraft, setRecoveryDraft] = useState<{
    data: AuditReadyCase;
    baseRevision: number;
    savedAt: string;
  } | null>(null);
  const [conflictDetected, setConflictDetected] = useState(false);

  const currentStep = useMemo(() => {
    if (searchParams.get("purchase") === "success") return 8;
    const requestedStep = Number(searchParams.get("step"));
    return Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 8
      ? requestedStep
      : 1;
  }, [searchParams]);
  const isDirty = JSON.stringify(caseData) !== savedSnapshot;
  const recoveryKey = `cbam_case_recovery_${sessionUser.uid}_${caseData.caseId || "unassigned"}`;

  useEffect(() => {
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  }, [isDirty]);

  useEffect(() => {
    const guardedUrl = window.location.href;
    const warnSpaNavigation = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented || event.button !== 0) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (!window.confirm("You have unsaved changes. Leave this working file anyway?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const warnHistoryNavigation = () => {
      if (!isDirty) return;
      if (window.confirm("You have unsaved changes. Leave this working file anyway?")) return;
      window.history.pushState(window.history.state, "", guardedUrl);
    };
    document.addEventListener("click", warnSpaNavigation, true);
    window.addEventListener("popstate", warnHistoryNavigation);
    return () => {
      document.removeEventListener("click", warnSpaNavigation, true);
      window.removeEventListener("popstate", warnHistoryNavigation);
    };
  }, [isDirty]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(recoveryKey);
      if (!raw) return;
      const candidate = JSON.parse(raw) as {
        data?: unknown;
        baseRevision?: unknown;
        savedAt?: unknown;
      };
      const parsed = AuditReadyCaseSchema.safeParse(candidate.data);
      if (
        parsed.success &&
        parsed.data.ownerId === sessionUser.uid &&
        parsed.data.caseId === caseData.caseId &&
        Number.isSafeInteger(candidate.baseRevision) &&
        typeof candidate.savedAt === "string" &&
        JSON.stringify(parsed.data) !== savedSnapshot
      ) {
        queueMicrotask(() => {
          setRecoveryDraft({
            data: parsed.data,
            baseRevision: candidate.baseRevision as number,
            savedAt: candidate.savedAt as string,
          });
        });
      }
    } catch (error) {
      console.warn("Local recovery copy could not be read", error);
    }
  }, [caseData.caseId, recoveryKey, savedSnapshot, sessionUser.uid]);

  useEffect(() => {
    if (!isDirty) return;
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(recoveryKey, JSON.stringify({
          data: caseData,
          baseRevision: revisionRef.current,
          savedAt: new Date().toISOString(),
        }));
      } catch (error) {
        console.warn("Local recovery copy could not be saved", error);
      }
    }, 750);
    return () => window.clearTimeout(timeout);
  }, [caseData, isDirty, recoveryKey]);

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

  const usableEntitlements = useMemo(() => {
    const matched = entitlements.filter((entitlement) => {
      const status = String(entitlement.status || "").toUpperCase();
      const scoped = entitlement.scopeCaseId || entitlement.caseId;
      const caseMatches = !scoped || scoped === caseData.caseId;
      return caseMatches && ["AVAILABLE", "ACTIVE", "PURCHASED"].includes(status);
    });
    // Prefer entitlements already bound to this case (pay-at-lock), then unbound legacy.
    return [...matched].sort((a, b) => {
      const aScoped = a.scopeCaseId === caseData.caseId || a.caseId === caseData.caseId ? 0 : 1;
      const bScoped = b.scopeCaseId === caseData.caseId || b.caseId === caseData.caseId ? 0 : 1;
      return aScoped - bScoped;
    });
  }, [entitlements, caseData.caseId]);

  const setStepAndUrl = (step: number) => {
    const safeStep = Math.min(8, Math.max(1, step));
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(safeStep));
    if (safeStep !== 8) {
      url.searchParams.delete("purchase");
    }
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const saved = await saveCase(
      parsed,
      parsed.caseId,
      undefined,
      revisionRef.current
    );
    revisionRef.current = saved.revision;
    setRevision(saved.revision);
    const snapshot = JSON.stringify(parsed);
    setSavedSnapshot(snapshot);
    setCaseData(parsed);
    setConflictDetected(false);
    setRecoveryDraft(null);
    localStorage.removeItem(recoveryKey);
  };

  const handleSave = async (): Promise<boolean> => {
    setSaving(true);
    setSaveStatus("");
    try {
      await persistDraft();
      setSaveTone("success");
      setSaveStatus("Saved.");
      return true;
    } catch (error) {
      console.error("Draft save failed", error);
      setSaveTone("error");
      const message = errorMessage(error);
      const conflict =
        message.toLowerCase().includes("another tab") ||
        message.includes("CASE_REVISION_CONFLICT") ||
        message.includes("aborted");
      setConflictDetected(conflict);
      if (conflict) {
        const recovery = {
          data: caseData,
          baseRevision: revisionRef.current,
          savedAt: new Date().toISOString(),
        };
        setRecoveryDraft(recovery);
        localStorage.setItem(recoveryKey, JSON.stringify(recovery));
      }
      setSaveStatus(conflict
        ? "A newer version was saved elsewhere. Your unsaved recovery copy is safe on this device."
        : `Could not save. ${message} Try again before leaving this file.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const restoreRecoveryDraft = () => {
    if (!recoveryDraft || recoveryDraft.baseRevision !== revisionRef.current) return;
    setCaseData(recoveryDraft.data);
    setRecoveryDraft(null);
    setSaveTone("neutral");
    setSaveStatus("Recovered your unsaved changes. Review them, then save.");
  };

  const discardRecoveryDraft = () => {
    localStorage.removeItem(recoveryKey);
    setRecoveryDraft(null);
  };

  const downloadRecoveryDraft = () => {
    if (!recoveryDraft) return;
    const blob = new Blob([JSON.stringify(recoveryDraft.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${caseData.caseId || "working-file"}-unsaved-recovery.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadLatestVersion = async () => {
    if (!caseData.caseId) return;
    setSaving(true);
    try {
      const latest = await getCase(caseData.caseId);
      const parsed = AuditReadyCaseSchema.parse(latest);
      revisionRef.current = latest.revision;
      setRevision(latest.revision);
      setCaseData(parsed);
      setSavedSnapshot(JSON.stringify(parsed));
      setConflictDetected(false);
      setSaveTone("success");
      setSaveStatus("Loaded the latest saved version. Your older recovery copy remains available for download.");
    } catch (error) {
      setSaveTone("error");
      setSaveStatus(`Could not load the latest version. ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStepChange = async (step: number) => {
    if (step === currentStep || saving) return;
    if (isDirty) {
      const saved = await handleSave();
      if (!saved) return;
    }
    setStepAndUrl(step);
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
      setSaveTone("success");
      setSaveStatus("Illustrative values were removed. Enter and evidence your case-specific data.");
      setStepAndUrl(1);
    } catch (error) {
      console.error("Illustrative scenario removal failed", error);
      setSaveTone("error");
      setSaveStatus(errorMessage(error));
    } finally {
      setClearingScenario(false);
    }
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

  const addProductionProcess = () => {
    setCaseData((previous) => ({
      ...previous,
      productionProcesses: [
        ...previous.productionProcesses,
        {
          processId: `PROC-${crypto.randomUUID().slice(0, 8)}`,
          name: "",
          producedGoodIndexes: previous.goods.length === 1 ? [0] : [],
          attributedDirectTco2e: "",
          attributedIndirectTco2e: "",
        },
      ],
    }));
  };

  const addSourceStream = () => {
    setCaseData((previous) => ({
      ...previous,
      sourceStreamRegister: [
        ...previous.sourceStreamRegister,
        {
          streamId: `STREAM-${crypto.randomUUID().slice(0, 8)}`,
          name: "",
          category: "MAJOR",
          instrumentId: previous.meterRegister[0]?.meterId || "",
          calibrationDate: "",
          calibrationValidityEnd: "",
          maximumPermissibleUncertaintyPercent: "",
          achievedUncertaintyPercent: "",
          appliedTier: "",
        },
      ],
    }));
  };

  const addEmissionSource = () => {
    setCaseData((previous) => ({
      ...previous,
      emissionSourceRegister: [
        ...previous.emissionSourceRegister,
        {
          sourceId: `ES-${crypto.randomUUID().slice(0, 8)}`,
          name: "",
          gas: "CO2",
          linkedProcessId: previous.productionProcesses[0]?.processId,
          linkedStreamId: previous.sourceStreamRegister[0]?.streamId,
        },
      ],
    }));
  };

  const addMeter = () => {
    setCaseData((previous) => ({
      ...previous,
      meterRegister: [
        ...previous.meterRegister,
        {
          meterId: `METER-${crypto.randomUUID().slice(0, 8)}`,
          description: "",
          meterType: "FUEL",
          calibrationDate: "",
          calibrationValidityEnd: "",
          maximumPermissibleUncertaintyPercent: "",
          achievedUncertaintyPercent: "",
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
      const parsed = AuditReadyCaseSchema.parse(updated);
      revisionRef.current = updated.revision;
      setRevision(updated.revision);
      setCaseData(parsed);
      setSavedSnapshot(JSON.stringify(parsed));
      localStorage.removeItem(recoveryKey);
      setEvidenceStatus(`Evidence ${decision.toLowerCase()} by the server-controlled review workflow.`);
    } catch (error) {
      console.error("Evidence review failed", error);
      setEvidenceStatus(errorMessage(error));
    }
  };

  const handleEvidenceDelete = async (evidenceId: string) => {
    if (!caseData.caseId) return;
    if (!window.confirm("Delete this evidence file and remove it from the draft? This cannot be undone.")) return;
    setEvidenceStatus("");
    try {
      const updated = await deleteEvidence({
        caseId: caseData.caseId,
        evidenceId,
        reason: "Removed by the working file owner before sealing.",
      });
      const parsed = AuditReadyCaseSchema.parse(updated);
      revisionRef.current = updated.revision;
      setRevision(updated.revision);
      setCaseData(parsed);
      setSavedSnapshot(JSON.stringify(parsed));
      localStorage.removeItem(recoveryKey);
      setEvidenceStatus("Evidence deleted by the audited server workflow.");
    } catch (error) {
      console.error("Evidence deletion failed", error);
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
      setSealStatus(
        `This file is unpaid. Pay ${CANONICAL_PRICING.priceFormatted} to lock this working file first.`
      );
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
          <button type="button" onClick={() => removeGood(index)} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove good</button>
        </div>
      ))}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">3. Installation, processes and monitoring</h2>
        <p className="mt-1 text-sm text-muted">Describe the installation boundary, then add the production processes, source streams, emission sources and meters that will appear in the sealed dossier. Draft rows may stay incomplete; sealing requires complete, evidence-linked registers.</p>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
        <div><FieldLabel helpKey="installationName">Installation name</FieldLabel><input aria-label="Installation name" value={datumValue(caseData.installation.name.value)} onChange={(event) => updateDatum("installation.name", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.installationName.source}</p></div>
        <div><FieldLabel helpKey="installationCountry">Installation country</FieldLabel><input aria-label="Installation country" value={datumValue(caseData.installation.country.value)} onChange={(event) => updateDatum("installation.country", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.installationCountry.source}</p></div>
        <div><FieldLabel helpKey="productionRoute">Production route</FieldLabel><input aria-label="Production route" value={datumValue(caseData.installation.productionRoute.value)} onChange={(event) => updateDatum("installation.productionRoute", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionRoute.source}</p></div>
        <div className="md:col-span-2"><FieldLabel helpKey="systemBoundary">System-boundary statement</FieldLabel><textarea aria-label="System-boundary statement" value={caseData.installation.systemBoundaries || ""} onChange={(event) => updatePlain("installation.systemBoundaries", event.target.value)} rows={5} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.systemBoundary.source}</p></div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Production processes</h3>
          <button type="button" onClick={addProductionProcess} className="inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Add process</button>
        </div>
        {caseData.productionProcesses.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">No production processes yet. Add the processes that produce your declared goods.</div>}
        {caseData.productionProcesses.map((process, index) => (
          <div key={process.processId} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
            <div><FieldLabel helpKey="productionProcessName">Process name</FieldLabel><input aria-label={`Production process ${index + 1} name`} value={process.name} onChange={(event) => updatePlain(`productionProcesses.${index}.name`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionProcessName.source}</p></div>
            <div><label className="mb-1 block text-xs font-bold">Process ID</label><input aria-label={`Production process ${index + 1} id`} value={process.processId} onChange={(event) => updatePlain(`productionProcesses.${index}.processId`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
            <div><FieldLabel helpKey="productionProcessAttribution">Attributed direct emissions (tCO2e)</FieldLabel><DecimalInput ariaLabel={`Production process ${index + 1} attributed direct`} min="0" value={process.attributedDirectTco2e} onValueChange={(value) => updatePlain(`productionProcesses.${index}.attributedDirectTco2e`, value)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionProcessAttribution.source}</p></div>
            <div><FieldLabel helpKey="productionProcessAttribution">Attributed indirect emissions (tCO2e)</FieldLabel><DecimalInput ariaLabel={`Production process ${index + 1} attributed indirect`} min="0" value={process.attributedIndirectTco2e} onValueChange={(value) => updatePlain(`productionProcesses.${index}.attributedIndirectTco2e`, value)} /></div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold">Produced goods</label>
              <div className="flex flex-wrap gap-3">
                {caseData.goods.map((good, goodIndex) => {
                  const checked = process.producedGoodIndexes.includes(goodIndex);
                  return (
                    <label key={`process-${index}-good-${goodIndex}`} className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setCaseData((previous) => {
                            const next = structuredClone(previous);
                            const indexes = new Set(next.productionProcesses[index].producedGoodIndexes);
                            if (event.target.checked) indexes.add(goodIndex);
                            else indexes.delete(goodIndex);
                            next.productionProcesses[index].producedGoodIndexes = [...indexes].sort((a, b) => a - b);
                            return next;
                          });
                        }}
                      />
                      Good {goodIndex + 1} ({datumValue(good.cnCode.value) || "CN pending"})
                    </label>
                  );
                })}
                {caseData.goods.length === 0 && <span className="text-sm text-muted">Add goods in step 2 before linking processes.</span>}
              </div>
            </div>
            <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, productionProcesses: previous.productionProcesses.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove process</button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Meters and calibration</h3>
          <button type="button" onClick={addMeter} className="inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Add meter</button>
        </div>
        {caseData.meterRegister.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">No meters yet. Add fuel, electricity or activity meters before linking source streams.</div>}
        {caseData.meterRegister.map((meter, index) => (
          <div key={meter.meterId} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
            <div><FieldLabel helpKey="meterDescription">Meter ID</FieldLabel><input aria-label={`Meter ${index + 1} id`} value={meter.meterId} onChange={(event) => updatePlain(`meterRegister.${index}.meterId`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
            <div><FieldLabel helpKey="meterDescription">Description</FieldLabel><input aria-label={`Meter ${index + 1} description`} value={meter.description} onChange={(event) => updatePlain(`meterRegister.${index}.description`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.meterDescription.source}</p></div>
            <div><label className="mb-1 block text-xs font-bold">Meter type</label><select aria-label={`Meter ${index + 1} type`} value={meter.meterType} onChange={(event) => updatePlain(`meterRegister.${index}.meterType`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="FUEL">Fuel</option><option value="ELECTRICITY">Electricity</option><option value="ACTIVITY">Activity</option><option value="OTHER">Other</option></select></div>
            <div><FieldLabel helpKey="meterCalibration">Calibration evidence</FieldLabel><select aria-label={`Meter ${index + 1} calibration evidence`} value={meter.calibrationEvidenceId || ""} onChange={(event) => updatePlain(`meterRegister.${index}.calibrationEvidenceId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">Select evidence</option>{caseData.evidenceRegister.map((evidence) => <option key={evidence.evidenceId} value={evidence.evidenceId}>{evidence.fileName}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.meterCalibration.source}</p></div>
            <div><FieldLabel helpKey="meterCalibration">Calibration date</FieldLabel><input aria-label={`Meter ${index + 1} calibration date`} type="date" value={meter.calibrationDate} onChange={(event) => updatePlain(`meterRegister.${index}.calibrationDate`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
            <div><FieldLabel helpKey="meterCalibration">Calibration validity end</FieldLabel><input aria-label={`Meter ${index + 1} calibration validity end`} type="date" value={meter.calibrationValidityEnd} onChange={(event) => updatePlain(`meterRegister.${index}.calibrationValidityEnd`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
            <div><FieldLabel helpKey="sourceStreamUncertainty">Maximum permissible uncertainty (%)</FieldLabel><DecimalInput ariaLabel={`Meter ${index + 1} MPU`} min="0" max="100" value={meter.maximumPermissibleUncertaintyPercent} onValueChange={(value) => updatePlain(`meterRegister.${index}.maximumPermissibleUncertaintyPercent`, value)} /></div>
            <div><FieldLabel helpKey="sourceStreamUncertainty">Achieved uncertainty (%)</FieldLabel><DecimalInput ariaLabel={`Meter ${index + 1} achieved uncertainty`} min="0" max="100" value={meter.achievedUncertaintyPercent} onValueChange={(value) => updatePlain(`meterRegister.${index}.achievedUncertaintyPercent`, value)} /></div>
            <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, meterRegister: previous.meterRegister.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove meter</button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Source streams</h3>
          <button type="button" onClick={addSourceStream} className="inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Add source stream</button>
        </div>
        {caseData.sourceStreamRegister.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">No source streams yet. Link each stream to a meter and calibration evidence.</div>}
        {caseData.sourceStreamRegister.map((stream, index) => (
          <div key={stream.streamId} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
            <div><FieldLabel helpKey="sourceStreamName">Stream name</FieldLabel><input aria-label={`Source stream ${index + 1} name`} value={stream.name} onChange={(event) => updatePlain(`sourceStreamRegister.${index}.name`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.sourceStreamName.source}</p></div>
            <div><label className="mb-1 block text-xs font-bold">Category</label><select aria-label={`Source stream ${index + 1} category`} value={stream.category} onChange={(event) => updatePlain(`sourceStreamRegister.${index}.category`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="MAJOR">Major</option><option value="MINOR">Minor</option><option value="DE_MINIMIS">De minimis</option></select></div>
            <div><FieldLabel helpKey="sourceStreamInstrument">Instrument / meter ID</FieldLabel><select aria-label={`Source stream ${index + 1} instrument`} value={stream.instrumentId} onChange={(event) => updatePlain(`sourceStreamRegister.${index}.instrumentId`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">Select meter</option>{caseData.meterRegister.map((meter) => <option key={meter.meterId} value={meter.meterId}>{meter.meterId} — {meter.description || meter.meterType}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.sourceStreamInstrument.source}</p></div>
            <div><FieldLabel helpKey="meterCalibration">Calibration evidence</FieldLabel><select aria-label={`Source stream ${index + 1} calibration evidence`} value={stream.calibrationEvidenceId || ""} onChange={(event) => updatePlain(`sourceStreamRegister.${index}.calibrationEvidenceId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">Select evidence</option>{caseData.evidenceRegister.map((evidence) => <option key={evidence.evidenceId} value={evidence.evidenceId}>{evidence.fileName}</option>)}</select></div>
            <div><FieldLabel helpKey="meterCalibration">Calibration date</FieldLabel><input aria-label={`Source stream ${index + 1} calibration date`} type="date" value={stream.calibrationDate} onChange={(event) => updatePlain(`sourceStreamRegister.${index}.calibrationDate`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
            <div><FieldLabel helpKey="meterCalibration">Calibration validity end</FieldLabel><input aria-label={`Source stream ${index + 1} calibration validity end`} type="date" value={stream.calibrationValidityEnd} onChange={(event) => updatePlain(`sourceStreamRegister.${index}.calibrationValidityEnd`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /></div>
            <div><FieldLabel helpKey="sourceStreamUncertainty">Maximum permissible uncertainty (%)</FieldLabel><DecimalInput ariaLabel={`Source stream ${index + 1} MPU`} min="0" max="100" value={stream.maximumPermissibleUncertaintyPercent} onValueChange={(value) => updatePlain(`sourceStreamRegister.${index}.maximumPermissibleUncertaintyPercent`, value)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.sourceStreamUncertainty.source}</p></div>
            <div><FieldLabel helpKey="sourceStreamUncertainty">Achieved uncertainty (%)</FieldLabel><DecimalInput ariaLabel={`Source stream ${index + 1} achieved uncertainty`} min="0" max="100" value={stream.achievedUncertaintyPercent} onValueChange={(value) => updatePlain(`sourceStreamRegister.${index}.achievedUncertaintyPercent`, value)} /></div>
            <div><FieldLabel helpKey="sourceStreamUncertainty">Applied tier (1–4)</FieldLabel><DecimalInput ariaLabel={`Source stream ${index + 1} applied tier`} min="1" max="4" value={stream.appliedTier} onValueChange={(value) => updatePlain(`sourceStreamRegister.${index}.appliedTier`, value)} /></div>
            <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, sourceStreamRegister: previous.sourceStreamRegister.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove source stream</button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Emission sources</h3>
          <button type="button" onClick={addEmissionSource} className="inline-flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-sm"><Plus className="h-4 w-4" /> Add emission source</button>
        </div>
        {caseData.emissionSourceRegister.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">No emission sources yet. Add each stack, combustion unit or process release point.</div>}
        {caseData.emissionSourceRegister.map((source, index) => (
          <div key={source.sourceId} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
            <div><FieldLabel helpKey="emissionSourceName">Emission source name</FieldLabel><input aria-label={`Emission source ${index + 1} name`} value={source.name} onChange={(event) => updatePlain(`emissionSourceRegister.${index}.name`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.emissionSourceName.source}</p></div>
            <div><label className="mb-1 block text-xs font-bold">Gas</label><select aria-label={`Emission source ${index + 1} gas`} value={source.gas} onChange={(event) => updatePlain(`emissionSourceRegister.${index}.gas`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="CO2">CO2</option><option value="N2O">N2O</option><option value="PFCs">PFCs</option><option value="CO2e">CO2e</option></select></div>
            <div><label className="mb-1 block text-xs font-bold">Linked process</label><select aria-label={`Emission source ${index + 1} process`} value={source.linkedProcessId || ""} onChange={(event) => updatePlain(`emissionSourceRegister.${index}.linkedProcessId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">None</option>{caseData.productionProcesses.map((process) => <option key={process.processId} value={process.processId}>{process.name || process.processId}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-bold">Linked source stream</label><select aria-label={`Emission source ${index + 1} stream`} value={source.linkedStreamId || ""} onChange={(event) => updatePlain(`emissionSourceRegister.${index}.linkedStreamId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">None</option>{caseData.sourceStreamRegister.map((stream) => <option key={stream.streamId} value={stream.streamId}>{stream.name || stream.streamId}</option>)}</select></div>
            <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, emissionSourceRegister: previous.emissionSourceRegister.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove emission source</button>
          </div>
        ))}
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
      <div><FieldLabel helpKey={helpKey}>{label}</FieldLabel><DecimalInput ariaLabel={label} min="0" max={isGridFactor ? GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH : undefined} placeholder={isGridFactor ? "0.4344" : undefined} value={datumValue(datum.value)} onValueChange={(value) => updateDatum(path, { value })} />{isGridFactor && Number(datum.value) > Number(GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH) && <p role="alert" className="mt-2 text-xs font-semibold text-status-blocked">Value exceeds 5 tCO2e/MWh. Check the source unit and decimal separator before continuing.</p>}<p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData[helpKey]?.source}</p></div>
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
        <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, precursors: previous.precursors.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove precursor</button>
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
        <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, carbonPriceRecords: previous.carbonPriceRecords.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove carbon-price record</button>
      </div>)}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6"><h3 className="font-bold">Upload immutable evidence</h3><div className="grid gap-4 md:grid-cols-2">
        <div><FieldLabel helpKey="evidenceFile">File</FieldLabel><input aria-label="Evidence file" type="file" accept=".pdf,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceFile.source}</p></div>
        <div><FieldLabel helpKey="evidenceDocumentType">Document type</FieldLabel><input aria-label="Evidence document type" value={evidenceDocumentType} onChange={(event) => setEvidenceDocumentType(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceDocumentType.source}</p></div>
        <div><FieldLabel helpKey="evidenceIssuer">Issuer</FieldLabel><input aria-label="Evidence issuer" value={evidenceIssuer} onChange={(event) => setEvidenceIssuer(event.target.value)} placeholder="Example: electricity supplier or installation operator" className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceIssuer.source}</p></div>
        <div><FieldLabel helpKey="evidenceIssueDate">Issue date</FieldLabel><input aria-label="Evidence issue date" type="date" value={evidenceIssueDate} onChange={(event) => setEvidenceIssueDate(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceIssueDate.source}</p></div>
        <div className="md:col-span-2"><FieldLabel helpKey="evidenceLinkedInput">Linked input</FieldLabel><select aria-label="Evidence linked input" value={evidenceLinkedInput} onChange={(event) => setEvidenceLinkedInput(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{EVIDENCE_LINK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{caseData.goods.flatMap((_, index) => [[`goods.${index}.cnCode`, `Good ${index + 1} CN code`], [`goods.${index}.productionVolume`, `Good ${index + 1} production`], [`goods.${index}.allocationShare`, `Good ${index + 1} allocation`]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}{caseData.precursors.flatMap((_, index) => [[`precursors.${index}.quantity`, `Precursor ${index + 1} quantity`], [`precursors.${index}.directEmissions`, `Precursor ${index + 1} direct emissions`], [`precursors.${index}.indirectEmissions`, `Precursor ${index + 1} indirect emissions`]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceLinkedInput.source}</p></div>
      </div><button type="button" onClick={handleEvidenceUpload} disabled={uploading} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload and register evidence</button><StatusBanner status={evidenceStatus} tone={evidenceStatus.toLowerCase().includes("failed") || evidenceStatus.includes("EVIDENCE_") ? "error" : "warning"} /></div>

      <div className="space-y-3">
        {caseData.evidenceRegister.map((evidence) => (
          <div key={evidence.evidenceId} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{evidence.fileName}</p>
                <p className="text-xs text-muted">{evidence.documentType} · {evidence.sizeBytes} bytes · {evidence.reviewStatus}/{evidence.supportStatus}/{evidence.malwareScanStatus}</p>
                <p className="mt-1 break-all font-mono text-[10px] text-muted">SHA-256 {evidence.fileHash}</p>
              </div>
              <button type="button" onClick={() => void handleEvidenceDelete(evidence.evidenceId)} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-status-blocked">
                <Trash2 className="h-4 w-4" /> Delete evidence
              </button>
            </div>
            <div className="mt-3">
              <FieldLabel helpKey="evidenceReviewNotes">Internal review note</FieldLabel>
              <div className="flex flex-col gap-2 md:flex-row">
                <input aria-label={`Review notes for ${evidence.fileName}`} value={reviewNotes[evidence.evidenceId] || ""} onChange={(event) => setReviewNotes((previous) => ({ ...previous, [evidence.evidenceId]: event.target.value }))} placeholder="Internal review note" className="flex-1 rounded border border-border bg-background p-2 text-sm" />
                <button type="button" disabled={evidence.malwareScanStatus !== "CLEAN"} onClick={() => handleEvidenceReview(evidence.evidenceId, "APPROVED")} className="min-h-11 rounded bg-status-pass px-3 py-2 text-xs font-semibold text-surface-elevated disabled:opacity-40">Approve</button>
                <button type="button" onClick={() => handleEvidenceReview(evidence.evidenceId, "REJECTED")} className="min-h-11 rounded bg-status-blocked px-3 py-2 text-xs font-semibold text-surface-elevated">Reject</button>
              </div>
            </div>
            {evidence.malwareScanStatus !== "CLEAN" && (
              <div className="mt-3 rounded border border-status-warning/30 bg-[color:var(--status-warning-soft)] p-3 text-xs text-status-warning">
                <p>{evidence.malwareScanStatus === "PENDING" ? "Security scan is still pending. Refresh this working file later; do not upload the same document again." : "This document cannot be approved in its current scan state. Upload a clean replacement or ask support to review the scan result."}</p>
                <a href="mailto:info@cbamvalid.com" className="mt-2 inline-flex min-h-11 items-center font-semibold underline">Contact support</a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">8. Lock &amp; download your package</h2>
        <p className="mt-1 text-sm text-muted">Clear any blockers, then lock and download the package for this working file.</p>
      </div>
      <section
        className={`rounded-xl border-2 p-5 ${
          readiness.isEligibleForSealing
            ? "border-forest-light bg-forest-pale text-forest"
            : "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-status-blocked"
        }`}
        aria-label="Your next action"
      >
        <p className="text-xs font-bold uppercase tracking-[0.14em]">Your next action</p>
        <h3 className="mt-1 text-lg font-bold">
          {readiness.isEligibleForSealing
            ? usableEntitlements.length > 0
              ? "This file is ready to lock"
              : "Quality checks passed — pay to lock this file"
            : `Fix ${readiness.criticalBlockers.length} blocker${readiness.criticalBlockers.length === 1 ? "" : "s"}`}
        </h3>
        <p className="mt-2 text-sm">
          {readiness.isEligibleForSealing
            ? "Payment and locking apply only to this working file. Same-file corrections remain included."
            : "Open the blocker list below and use each “Fix in step” link. A blocked lock never creates a charge."}
        </p>
        {readiness.isEligibleForSealing && usableEntitlements.length === 0 ? (
          <Link
            href={`/credits/buy?caseId=${encodeURIComponent(caseData.caseId || "")}`}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-surface"
          >
            Pay {CANONICAL_PRICING.priceFormatted} to lock this file
          </Link>
        ) : null}
        {readiness.isEligibleForSealing && usableEntitlements.length > 0 ? (
          <button
            type="button"
            onClick={handleSeal}
            disabled={sealing}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-surface disabled:opacity-50"
          >
            {sealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            Lock &amp; download package
          </button>
        ) : null}
      </section>
      {scenarioActive && calculation.result && (
        <section className="rounded-xl border-2 border-forest-light bg-forest-pale p-6 text-forest" aria-label="Illustrative scenario report">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em]">Illustrative scenario · Not for submission</p>
              <h3 className="mt-1 flex items-center gap-2 text-lg font-bold"><BookOpenCheck className="h-5 w-5" /> Scenario report</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed">
                This report is calculated from the example values prefilled across all eight steps. It demonstrates the workflow and expected output structure; it is not verified evidence and cannot be sealed.
              </p>
            </div>
            <span className="rounded bg-forest px-3 py-1 font-mono text-[10px] text-surface-elevated">{ILLUSTRATIVE_SCENARIO_ID}</span>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Installation</dt><dd className="font-semibold">{String(caseData.installation.name.value)}</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Reporting period</dt><dd className="font-semibold">{String(caseData.reportingPeriod.year.value)} · {String(caseData.reportingPeriod.quarter.value)}</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Production</dt><dd className="font-semibold">{calculation.result.productionVolume} t</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Electricity consumed</dt><dd className="font-semibold">{String(caseData.electricityConsumed.value)} MWh</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Grid factor</dt><dd className="font-semibold">{String(caseData.gridEmissionFactor.value)} tCO2e/MWh</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Direct emissions</dt><dd className="font-semibold">{calculation.result.totalDirectEmissions} tCO2e</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Indirect emissions</dt><dd className="font-semibold">{calculation.result.totalIndirectEmissions} tCO2e</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Precursor emissions</dt><dd className="font-semibold">{calculation.result.totalPrecursorEmissions} tCO2e</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Total embedded</dt><dd className="font-semibold">{calculation.result.totalEmbeddedEmissions} tCO2e</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Aggregate intensity</dt><dd className="font-semibold">{calculation.result.specificEmbeddedEmissions} tCO2e/t</dd></div>
            <div className="rounded border border-forest-light/40 bg-surface-elevated p-3"><dt className="text-xs text-forest-light">Illustrative carbon price</dt><dd className="font-semibold">{String(caseData.carbonPriceRecords[0]?.amountPaid ?? "—")} {caseData.carbonPriceRecords[0]?.currency ?? ""}</dd></div>
          </dl>
          <div className="mt-5 overflow-x-auto rounded border border-forest-light/40 bg-surface-elevated">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-forest-light/40 bg-forest-pale text-xs uppercase"><tr><th className="p-3">CN code</th><th className="p-3">Production</th><th className="p-3">Allocation</th><th className="p-3">Allocated emissions</th><th className="p-3">Intensity</th></tr></thead>
              <tbody>{calculation.result.goods.map((good) => <tr key={good.goodIndex} className="border-b border-forest-pale last:border-0"><td className="p-3 font-mono">{good.cnCode}</td><td className="p-3">{good.productionVolume} t</td><td className="p-3">{good.allocationShare}</td><td className="p-3">{good.allocatedEmbeddedEmissions} tCO2e</td><td className="p-3">{good.specificEmbeddedEmissions} tCO2e/t</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-forest">
            Verification remains intentionally blocked until the illustrative scenario is removed and every material input is supported by approved, malware-clean evidence.
          </p>
        </section>
      )}
      <section className="rounded-xl border border-border-strong bg-dark p-6 text-surface-elevated shadow-sm" aria-label="Sealed package deliverables">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-seal">Successful sealed release</p>
            <h3 className="mt-1 flex items-center gap-2 text-xl font-bold"><PackageCheck className="h-6 w-6" /> What the Preparation Pack actually delivers</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-dark-text/80">The blue scenario above is a free workflow demonstration. A paid release is created only from case-specific data after every preparation control passes and produces a verifier-facing, immutable package.</p>
          </div>
          <span className="shrink-0 rounded-full border border-border-strong px-3 py-1 text-xs font-semibold">27 controlled components</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {SEALED_PACKAGE_HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return <article key={item.title} className="rounded-lg border border-border-strong bg-dark p-4"><Icon className="h-5 w-5 text-seal" /><h4 className="mt-3 text-sm font-bold">{item.title}</h4><p className="mt-1 text-xs leading-relaxed text-dark-text/80">{item.detail}</p></article>;
          })}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-muted">Professional boundary: CBAMValid prepares the operator dossier and evidence chain. Only an appropriately accredited independent verifier can issue a verification opinion.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-6">
          <h3 className="flex items-center gap-2 font-bold"><Shield className="h-5 w-5 text-accent" /> Verification readiness</h3>
          <div className={`mt-4 rounded border p-4 ${readiness.isEligibleForSealing ? "border-forest-light bg-forest-pale text-forest" : "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-status-blocked"}`}>
            <div className="flex items-center justify-between gap-4 text-sm font-semibold"><span>{readiness.status.replaceAll("_", " ")}</span><span>{readiness.completenessPercentage}%</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className={`h-full rounded-full ${readiness.isEligibleForSealing ? "bg-status-pass" : "bg-status-blocked"}`} style={{ width: `${readiness.completenessPercentage}%` }} /></div>
            <p className="mt-2 text-xs">{readiness.passedControls}/{readiness.applicableControls} applicable controls passed · {readiness.criticalBlockers.length} blocker(s)</p>
          </div>

          {readiness.allGaps.length > 0 ? (
            <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1" aria-label="Readiness remediation plan">
              {readiness.allGaps.map((gap) => {
                const resolution = gapResolution(gap);
                return (
                  <article key={gap.gapId} className="rounded-lg border border-status-blocked/30 bg-[color:var(--status-blocked-soft)] p-4 text-xs text-status-blocked">
                    <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-blocked" /><div><h4 className="font-bold">{gap.requirement}</h4><p className="mt-1 leading-relaxed text-status-blocked">{gap.whyItMatters}</p></div></div>
                    <div className="mt-3 rounded border border-status-blocked/30 bg-surface-elevated/70 p-3"><p><strong>How to fix:</strong> {resolution.action}</p><p className="mt-1"><strong>Evidence:</strong> {resolution.evidence}</p></div>
                    <button type="button" onClick={() => void handleStepChange(resolution.step)} className="mt-3 inline-flex min-h-11 items-center gap-1 font-semibold text-status-blocked underline underline-offset-2">Fix in step {resolution.step} <ArrowRight className="h-3 w-3" /></button>
                  </article>
                );
              })}
            </div>
          ) : <div className="mt-4 rounded-lg border border-forest-pale bg-forest-pale p-4 text-sm text-forest"><CheckCircle2 className="mb-2 h-5 w-5" />Every automated preparation control has passed. The independent verifier status remains separate.</div>}

          {currentReleasesCount > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <FieldLabel helpKey="correctionReason">Correction reason for this update</FieldLabel>
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

          {usableEntitlements.length === 0 ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-muted">
                Draft is free. Pay once to lock this file. Same file: correct and re-lock as needed.
                A new file needs a new payment.
              </p>
              <Link
                href={`/credits/buy?caseId=${encodeURIComponent(caseData.caseId || "")}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-accent p-3 text-sm font-semibold text-surface"
              >
                Pay {CANONICAL_PRICING.priceFormatted} to lock this file
              </Link>
            </div>
          ) : null}

          {readiness.isEligibleForSealing && usableEntitlements.length > 0 ? (
            <button type="button" aria-label="Lock and download package" onClick={handleSeal} disabled={sealing} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-accent p-3 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-40">{sealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Lock &amp; download package</button>
          ) : null}
          {readiness.isEligibleForSealing ? null : (
            <button type="button" onClick={() => void handleStepChange(scenarioActive ? 1 : 7)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-accent p-3 text-sm font-semibold text-surface"><FileUp className="h-4 w-4" /> {scenarioActive ? "Replace demo with case data" : "Resolve evidence blockers"}</button>
          )}
          <StatusBanner status={sealStatus} tone="error" />
          <p className="mt-3 text-xs text-muted">
            Payment is for this working file only. Failed or blocked locks charge nothing. Re-download is free.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-surface p-6">
          <h3 className="flex items-center gap-2 font-bold"><FileCode2 className="h-5 w-5 text-accent" /> Mathematical audit and emissions flow</h3>
          {calculation.error ? <div className="mt-4"><StatusBanner status={calculation.error} tone="warning" /></div> : <>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted">Total embedded</span><strong className="block">{calculation.result?.totalEmbeddedEmissions} tCO2e</strong></div><div><span className="text-muted">Aggregate intensity</span><strong className="block">{calculation.result?.specificEmbeddedEmissions} tCO2e/t</strong></div><div><span className="text-muted">Allocation total</span><strong className="block">{calculation.result?.allocationShareTotal}</strong></div><div><span className="text-muted">Reconciliation delta</span><strong className="block">{calculation.result?.allocationReconciliationDelta}</strong></div></div>
            {calculation.result && numeric(calculation.result.totalEmbeddedEmissions) > 0 && <div className="mt-5 rounded-lg border border-border bg-neutral-soft p-4" aria-label="Emissions composition chart"><div className="flex items-center justify-between text-xs"><strong>Emissions composition</strong><span className="text-muted">tCO2e</span></div><div className="mt-3 flex h-8 overflow-hidden rounded-md bg-surface-secondary" title="Direct, electricity and precursor emissions"><div className="bg-forest" style={{ width: `${percentOf(calculation.result.installationDirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} /><div className="bg-forest-light" style={{ width: `${percentOf(calculation.result.electricityIndirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} /><div className="bg-seal" style={{ width: `${percentOf(calculation.result.precursorDirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} /><div className="bg-seal-light" style={{ width: `${percentOf(calculation.result.precursorIndirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} /></div><div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2"><span><i className="mr-2 inline-block h-2 w-2 bg-forest" />Installation direct {calculation.result.installationDirectEmissions}</span><span><i className="mr-2 inline-block h-2 w-2 bg-forest-light" />Electricity indirect {calculation.result.electricityIndirectEmissions}</span><span><i className="mr-2 inline-block h-2 w-2 bg-seal" />Precursor direct {calculation.result.precursorDirectEmissions}</span><span><i className="mr-2 inline-block h-2 w-2 bg-seal-light" />Precursor indirect {calculation.result.precursorIndirectEmissions}</span></div></div>}
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{calculation.result?.trace.map((trace) => <div key={trace.calculationId} className="rounded border border-border bg-neutral-soft p-3 font-mono text-xs"><div className="font-bold text-accent">{trace.formulaId}</div><div>{String(trace.outputValue)} {trace.outputUnit}</div><div className="break-all text-[10px] text-muted">SHA-256 {trace.calculationHash}</div></div>)}</div>
          </>}
        </section>
      </div>
    </div>
  );

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8][currentStep - 1];
  const activeStep = STEPS[currentStep - 1] ?? STEPS[0];
  const workingFileName =
    String(caseData.installation?.name?.value || "").trim() ||
    String(caseData.exporterIdentity?.legalName?.value || "").trim() ||
    "Working file";

  return (
    <div className="min-h-screen bg-background px-4 py-4 pb-28 text-foreground md:px-8 md:py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              Step {currentStep} of 8
            </p>
            <h1 className="truncate text-2xl font-bold">{activeStep.label}</h1>
            <p className="mt-1 text-sm text-muted">
              Complete this section, then save and continue.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${isDirty ? "text-status-warning" : "text-muted"}`}>
              {saving ? "Saving…" : isDirty ? "Unsaved changes" : "Saved"}
            </span>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !isDirty}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </header>

        <StatusBanner status={saveStatus} tone={saveTone} />
        {recoveryDraft && (
          <section
            role="alert"
            className="rounded-lg border border-status-warning/40 bg-[color:var(--status-warning-soft)] p-4 text-sm text-status-warning"
          >
            <h2 className="font-bold">
              {recoveryDraft.baseRevision === revision
                ? "Unsaved changes can be recovered"
                : "An older unsaved recovery copy is available"}
            </h2>
            <p className="mt-1">
              Saved locally {new Date(recoveryDraft.savedAt).toLocaleString()}.
              {recoveryDraft.baseRevision === revision
                ? " Restore it to continue where you stopped."
                : " It cannot overwrite the newer server version automatically. Download it before loading the latest version if you need to compare changes."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {recoveryDraft.baseRevision === revision && (
                <button type="button" onClick={restoreRecoveryDraft} className="rounded bg-accent px-3 py-2 font-semibold text-surface">
                  Restore unsaved changes
                </button>
              )}
              <button type="button" onClick={downloadRecoveryDraft} className="rounded border border-current px-3 py-2 font-semibold">
                Download recovery copy
              </button>
              <button type="button" onClick={discardRecoveryDraft} className="rounded px-3 py-2 font-semibold underline">
                Discard recovery copy
              </button>
            </div>
          </section>
        )}
        {conflictDetected && (
          <section role="alert" className="rounded-lg border border-status-blocked/40 bg-[color:var(--status-blocked-soft)] p-4 text-sm text-status-blocked">
            <h2 className="font-bold">This tab is out of date</h2>
            <p className="mt-1">Download your recovery copy if needed, then load the latest server version. Nothing was overwritten.</p>
            <button type="button" onClick={() => void loadLatestVersion()} disabled={saving} className="mt-3 rounded bg-accent px-3 py-2 font-semibold text-surface disabled:opacity-50">
              Load latest version
            </button>
          </section>
        )}

        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-24">
            <WorkingFileJourneyStrip
              currentStep={currentStep}
              completenessPercentage={readiness.completenessPercentage}
              blockerCount={readiness.criticalBlockers.length}
              hasPaidUnlock={usableEntitlements.length > 0}
              caseId={caseData.caseId || ""}
              canLock={readiness.isEligibleForSealing && usableEntitlements.length > 0}
              onGoToStep={(step) => void handleStepChange(step)}
              onLock={() => void handleSeal()}
            />
            <details className="mt-3 rounded-lg border border-border bg-surface p-3 text-xs text-muted">
              <summary className="cursor-pointer font-semibold text-foreground">File details</summary>
              <dl className="mt-3 space-y-2">
                <div><dt className="font-semibold">File</dt><dd>{workingFileName}</dd></div>
                <div><dt className="font-semibold">Scope</dt><dd>One installation · one reporting year</dd></div>
                <div><dt className="font-semibold">File ID</dt><dd className="break-all font-mono text-[10px]">{caseData.caseId || "UNASSIGNED"}</dd></div>
                <div><dt className="font-semibold">Revision</dt><dd>{revision}</dd></div>
              </dl>
            </details>
          </aside>

          <div className="order-1 min-w-0 space-y-4 lg:order-2">
            {scenarioActive && (
              <aside className="flex flex-col justify-between gap-3 rounded-xl border border-forest-light bg-forest-pale p-4 text-forest sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em]">Illustrative scenario</p>
                  <p className="mt-1 text-sm">Example values are visible for learning only and cannot be locked.</p>
                </div>
                <button
                  type="button"
                  onClick={handleStartBlankCase}
                  disabled={clearingScenario}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-forest bg-surface-elevated px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {clearingScenario ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
                  {clearingScenario ? "Removing…" : "Start blank"}
                </button>
              </aside>
            )}

            <section aria-label={`Step ${currentStep}: ${activeStep.label}`} className="py-1">
              {stepContent()}
            </section>

            <details className="rounded-lg border border-status-warning/30 bg-[color:var(--status-warning-soft)] p-4 text-xs leading-relaxed text-status-warning print:hidden">
              <summary className="cursor-pointer font-semibold">Independent-verification boundary</summary>
              <p className="mt-2">
                CBAMValid generates an exporter-prepared verification dossier. It is not an official European Commission verification opinion and does not replace independent verification by an appropriately accredited body.
              </p>
            </details>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface px-3 py-3 shadow-[0_-4px_8px_rgba(0,0,0,0.08)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => void handleStepChange(currentStep - 1)}
            disabled={currentStep === 1 || saving}
            className="inline-flex min-h-11 items-center gap-2 rounded border border-border px-3 py-2 text-sm disabled:opacity-40 sm:px-4"
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </button>
          <span className="hidden text-sm font-bold text-muted sm:block">
            Step {currentStep} of 8 · {STEPS[currentStep - 1]?.label}
          </span>
          <button
            type="button"
            onClick={() => currentStep === 8 ? void handleSave() : void handleStepChange(currentStep + 1)}
            disabled={saving || (currentStep === 8 && !isDirty)}
            className="inline-flex min-h-11 items-center gap-2 rounded bg-accent px-3 py-2 text-sm font-semibold text-surface disabled:opacity-40 sm:px-4"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : currentStep === 8 ? <Save className="h-4 w-4" /> : null}
            {currentStep === 8 ? "Save draft" : "Save & continue"}
            {currentStep < 8 ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
