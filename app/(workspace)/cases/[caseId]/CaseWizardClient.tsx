"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Eraser,
  FileCode2,
  FileCheck2,
  FileUp,
  LockKeyhole,
  Loader2,
  Menu,
  PackageCheck,
  Plus,
  Save,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { DecimalInput } from "@/components/cbam/DecimalInput";
import { FieldHelp } from "@/components/cbam/FieldHelp";
import { QcInspectorRail } from "@/components/cbam/QcInspectorRail";
import { WorkingFileJourneyStrip } from "@/components/cbam/WorkingFileJourneyStrip";
import { gapResolution } from "@/lib/cbam/gap-resolution";
import { packsUnlockableFromCredits } from "@/lib/billing/credit-contract";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";
import { performDossierCalculations } from "@/lib/cbam/calculator";
import { fieldHelpData, type FieldHelpKey } from "@/lib/cbam/field-help";
import { gradeEvidenceRecord } from "@/lib/cbam/evidence-quality";
import {
  buildEvidenceLinkOptions,
  clampWizardStep,
  deriveStep8Status,
  evaluateSealAttempt,
  firstDataIssuePath,
  formatStep8CtaLabel,
  parseStepFromQuery,
  STEP8_FINAL_SUPPORTING_TEXT,
  STEP8_FINAL_TITLE,
  STEP8_PACKAGE_PREVIEW_HEADLINE,
  STEP8_REVIEW_ACTIONS_LABEL,
  STEP8_SEALED_SUCCESS_HEADLINE,
  STEP8_STATUS_LABELS,
  STEP_STATE_LABELS,
  summarizeStep8Actions,
  translateSealError,
  validateWizardStep,
  wizardStepDescription,
  wizardStepTitle,
  wizardStepTotalFields,
  type Step8Status,
  type WizardStepIssue,
  type WizardStepperState,
  type WizardStepValidation,
} from "@/lib/cbam/wizard-validation";
import { CBAM_WORKFLOW_STEPS, getWorkflowStep } from "@/lib/cbam/workflow-definition";
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
  type InputDatum,
  type UnitCode,
} from "@/lib/cbam/schema";
import { uploadEvidenceFile } from "@/lib/cbam/evidence-upload";
import {
  assignOrganisationReviewer,
  getAccountOverview,
  reviewEvidence,
  saveCase,
  sealReport,
  updateOwnProfile,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";

interface CaseWizardClientProps {
  sessionUser: { uid: string; email: string };
  initialCase: AuditReadyCase;
  availableEntitlements: PreparationPackEntitlement[];
}

const SECTORS = [
  "IRON_AND_STEEL",
  "ALUMINIUM",
  "CEMENT",
  "FERTILISERS",
  "HYDROGEN",
  "ELECTRICITY",
] as const;

const SOURCE_TYPES = ["PRIMARY", "SECONDARY", "DEFAULT", "ESTIMATED", "REGULATORY"] as const;

const SEALED_PACKAGE_HIGHLIGHTS = [
  { title: "11 professional PDFs", detail: "Executive report, monitoring plan, calculation annex, readiness assessment and methodology records", icon: FileCheck2 },
  { title: "Verifier workspace", detail: "Spreadsheet with 14+ worksheets, filters, validations, source links and verifier sign-off", icon: FileCode2 },
  { title: "Evidence assurance", detail: "Immutable evidence copies, field links, issuer/date metadata, malware status and SHA-256 register", icon: Shield },
  { title: "Verified package", detail: "25-part verifier package, integrity manifest, secure digital signature and tamper-proof file fingerprint", icon: LockKeyhole },
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

/** Friendly, plain-English status label for an evidence record. */
function humanizeEvidenceStatus(
  reviewStatus: string,
  supportStatus: string,
  malwareScanStatus: string
): string {
  const review =
    reviewStatus === "PENDING"
      ? "Pending review"
      : reviewStatus === "REVIEW_REQUIRED"
        ? "Review required"
        : reviewStatus === "APPROVED"
          ? "Approved"
          : reviewStatus === "REJECTED"
            ? "Rejected"
            : reviewStatus === "ACCEPTED"
              ? "Accepted"
              : reviewStatus;
  const support =
    supportStatus === "SUPPORTED"
      ? "Supported"
      : supportStatus === "UNSUPPORTED"
        ? "Not supported"
        : supportStatus === "PENDING"
          ? "Check pending"
          : supportStatus;
  const malware =
    malwareScanStatus === "CLEAN"
      ? "Safe to use"
      : malwareScanStatus === "PENDING"
        ? "Scan pending"
        : malwareScanStatus === "QUARANTINED"
          ? "Quarantined"
          : malwareScanStatus === "INFECTED"
            ? "Threat found"
            : malwareScanStatus;
  return `${review} · ${support} · ${malware}`;
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
  return <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>{status}</div>;
}

const STEP_STATE_STYLES: Record<WizardStepperState, string> = {
  NOT_STARTED: "border-border bg-neutral-soft text-muted",
  IN_PROGRESS: "border-border bg-neutral-soft text-foreground",
  NEEDS_INFORMATION: "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-status-blocked",
  NEEDS_DOCUMENTS: "border-status-warning/40 bg-[color:var(--status-warning-soft)] text-status-warning",
  AWAITING_REVIEW: "border-border bg-surface text-muted",
  COMPLETE: "border-forest-light bg-forest-pale text-forest",
};

const STEP8_STATUS_STYLES: Record<Step8Status, string> = {
  BLOCKED: "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-status-blocked",
  PAYMENT_REQUIRED: "border-status-warning/40 bg-[color:var(--status-warning-soft)] text-status-warning",
  READY_TO_LOCK: "border-forest-light bg-forest-pale text-forest",
  LOCKING: "border-border bg-neutral-soft text-foreground",
  LOCKED: "border-forest-light bg-forest-pale text-forest",
  LOCK_FAILED: "border-status-blocked/40 bg-[color:var(--status-blocked-soft)] text-status-blocked",
};

function Step8StateBadge({ status }: { status: Step8Status }) {
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STEP8_STATUS_STYLES[status]}`} aria-label={`Final review status: ${STEP8_STATUS_LABELS[status]}`}>
      {STEP8_STATUS_LABELS[status]}
    </span>
  );
}

function FieldError({ issue }: { issue?: WizardStepIssue }) {
  if (!issue) return null;
  const short =
    issue.kind === "EVIDENCE"
      ? `Evidence required for ${issue.label}. Upload and link the source document.`
      : `Enter a value for ${issue.label}.`;
  return (
    <p role="alert" className="mt-1.5 text-xs font-semibold text-status-blocked">
      {short}
    </p>
  );
}

export default function CaseWizardClient({ sessionUser, initialCase, availableEntitlements }: CaseWizardClientProps) {
  const router = useRouter();
  const sealRequestId = useRef<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [caseData, setCaseData] = useState<AuditReadyCase>(() => AuditReadyCaseSchema.parse(initialCase));
  const entitlements = availableEntitlements;
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
  const [evidenceLinkedInput, setEvidenceLinkedInput] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [correctionReason, setCorrectionReason] = useState("");
  // FAZ UX — Step 8 never redirects back to Step 7; the blocker panel is
  // revealed in place and the user chooses any remediation step themselves.
  const blockerPanelRef = useRef<HTMLDivElement | null>(null);
  const releaseCommandRef = useRef<HTMLElement | null>(null);
  const [showBlockers, setShowBlockers] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [nextHint, setNextHint] = useState("");
  const [sealTechnicalCode, setSealTechnicalCode] = useState("");
  const [sealTone, setSealTone] = useState<"neutral" | "success" | "error" | "warning">("neutral");
  const [sealProgress, setSealProgress] = useState<"IDLE" | "VALIDATING" | "CREATING" | "SUCCESS" | "ERROR">("IDLE");
  // FAZ UX — mobile step drawer and step-8 advanced technical accordion.
  const [mobileStepsOpen, setMobileStepsOpen] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  // FAZ 13 — customer organisation profile used for peer-to-peer in-org review.
  const [myOrganisationId, setMyOrganisationId] = useState("");
  const [myRole, setMyRole] = useState("");
  const [organisationStatus, setOrganisationStatus] = useState("");
  const [orgTargetEmail, setOrgTargetEmail] = useState("");
  const [orgTargetRole, setOrgTargetRole] = useState<"INTERNAL_REVIEWER" | "DATA_OWNER">("INTERNAL_REVIEWER");
  const [orgAssigning, setOrgAssigning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAccountOverview()
      .then((overview) => {
        if (cancelled) return;
        const credits = overview.credits as { availableCredits?: number } | undefined;
        setAvailableCredits(Number(credits?.availableCredits || 0));
        const profile = overview.profile as { organisationId?: string; role?: string } | undefined;
        setMyOrganisationId(profile?.organisationId || "");
        setMyRole((profile?.role || "").toUpperCase());
      })
      .catch((error) => {
        console.error("Failed to load case credit balance", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore ?step=N after refresh / hard navigation without causing a
  // hydration mismatch (the first paint still matches the server default).
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const step = parseStepFromQuery(new URLSearchParams(window.location.search).get("step"));
    queueMicrotask(() => {
      setCurrentStep((previous) => (previous === step ? previous : step));
      setUrlReady(true);
    });
  }, []);

  // Persist the step in the URL (no history entries) so a refresh reopens the
  // same screen. Save, seal failures and data refresh never change the step.
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams(window.location.search);
    const urlStep = parseStepFromQuery(params.get("step"));
    if (urlStep !== currentStep) {
      params.set("step", String(currentStep));
      const query = params.toString();
      router.replace(`${window.location.pathname}${query ? `?${query}` : ""}`, { scroll: false });
    }
  }, [currentStep, router, urlReady]);

  const readiness = useMemo(() => assessCaseReadiness(caseData), [caseData]);
  const scenarioActive = useMemo(() => isIllustrativeScenarioActive(caseData), [caseData]);
  const calculation = useMemo(() => {
    try {
      return { result: performDossierCalculations(caseData), error: "" };
    } catch (error) {
      return { result: null, error: errorMessage(error) };
    }
  }, [caseData]);

  // FAZ P0 — per-step validation and stepper states (unconditional Next removed).
  const stepValidations = useMemo(() => {
    const map: Record<number, WizardStepValidation> = {};
    for (let step = 1; step <= 8; step += 1) {
      map[step] = validateWizardStep(step, caseData);
    }
    return map;
  }, [caseData]);

  const stepStates = useMemo(() => {
    const map: Record<number, WizardStepperState> = {};
    for (let step = 1; step <= 8; step += 1) {
      map[step] = stepValidations[step].state;
    }
    return map;
  }, [stepValidations]);

  const currentStepValidation = stepValidations[currentStep];

  // FAZ UX — Step 8 evidence assurance score derived from structured records.
  const evidenceAssurance = useMemo(() => {
    const records = caseData.evidenceRegister;
    if (records.length === 0) return { score: 0, approvedCount: 0, pendingCount: 0, total: 0 };
    const approvedCount = records.filter(
      (record) =>
        record.reviewStatus === "APPROVED" &&
        record.supportStatus === "SUPPORTED" &&
        record.malwareScanStatus === "CLEAN"
    ).length;
    const pendingCount = records.filter((record) => record.reviewStatus === "PENDING").length;
    return {
      score: Math.round((approvedCount / records.length) * 100),
      approvedCount,
      pendingCount,
      total: records.length,
    };
  }, [caseData.evidenceRegister]);

  const step8Actions = useMemo(() => {
    const calculationSummary = calculation.error
      ? { error: calculation.error }
      : calculation.result
        ? {
            allocationShareTotal: calculation.result.allocationShareTotal,
            allocationReconciliationDelta: calculation.result.allocationReconciliationDelta,
          }
        : null;
    return summarizeStep8Actions(caseData, calculationSummary);
  }, [calculation, caseData]);

  const linkOptions = useMemo(() => buildEvidenceLinkOptions(caseData), [caseData]);

  const fieldIssue = (path: string): WizardStepIssue | undefined =>
    currentStepValidation?.issues.find((issue) => issue.fieldPath === path);

  const inputClass = (path: string, extra = ""): string => {
    const issue = fieldIssue(path);
    const base = issue
      ? "w-full rounded border-2 border-status-blocked bg-background p-2 text-sm"
      : "w-full rounded border border-border bg-background p-2 text-sm";
    return `${base} ${extra}`.trim();
  };

  const focusField = (path: string) => {
    const element = document.querySelector<HTMLElement>(`[data-field-path="${path}"]`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    const control = element.querySelector("input, textarea, select");
    if (control instanceof HTMLElement) control.focus();
  };

  // FAZ UX — transient guidance (errors, next hint, blocker panel) starts
  // clean on every step and reveals itself on demand. Navigation and sealing
  // stay decoupled: any step may be opened, sealing remains fail-closed.
  const navigateToStep = (step: number) => {
    setShowErrors(false);
    setNextHint("");
    setShowBlockers(false);
    setMobileStepsOpen(false);
    setCurrentStep(clampWizardStep(step));
  };

  const goToNext = () => {
    const validation = stepValidations[currentStep];
    const first = firstDataIssuePath(validation);
    if (first) {
      setShowErrors(true);
      setNextHint(
        `Complete ${validation.missingFieldCount} required field${validation.missingFieldCount === 1 ? "" : "s"} before continuing, or save your draft now.`
      );
      focusField(first);
      return;
    }
    navigateToStep(currentStep + 1);
  };

  // FAZ UX — the user may open any step, including the final review, at any
  // time. Evidence gaps surface as NEEDS_EVIDENCE but never block navigation;
  // sealing remains fail-closed regardless.
  const goToStep = (step: number) => {
    navigateToStep(step);
  };

  // QC inspector navigation — jumping to another step resets transient
  // guidance by design, but re-selecting the current step must never wipe
  // the error panels the operator is reading. In that case we only bring
  // the first field of the step back into view.
  const handleInspectorGoToStep = (step: number) => {
    if (step === currentStep) {
      document
        .querySelector<HTMLElement>("[data-field-path]")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    goToStep(step);
  };

  const revealSealBlockers = () => {
    setShowBlockers(true);
    setSealStatus(
      `${readiness.criticalBlockers.length} open requirement${readiness.criticalBlockers.length === 1 ? "" : "s"} and ${readiness.allGaps.length} action item${readiness.allGaps.length === 1 ? "" : "s"} must be resolved before sealing.`
    );
    setSealTechnicalCode("");
    setSealTone("warning");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        blockerPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        const firstAction = blockerPanelRef.current?.querySelector<HTMLElement>(
          '[data-testid="first-blocker-action"]'
        );
        firstAction?.focus();
      });
    });
  };

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
      const entitlementId = typeof entitlement.entitlementId === "string"
        ? entitlement.entitlementId.trim()
        : "";
      // A list row without its server identifier cannot be reserved or consumed.
      // Never advertise READY_TO_LOCK from stale/incomplete cached metadata.
      return Boolean(entitlementId) && caseMatches && ["AVAILABLE", "ACTIVE", "PURCHASED"].includes(status);
    });
    // Prefer entitlements already bound to this case (pay-at-lock), then unbound legacy.
    return [...matched].sort((a, b) => {
      const aScoped = a.scopeCaseId === caseData.caseId || a.caseId === caseData.caseId ? 0 : 1;
      const bScoped = b.scopeCaseId === caseData.caseId || b.caseId === caseData.caseId ? 0 : 1;
      return aScoped - bScoped;
    });
  }, [entitlements, caseData.caseId]);

  const releasesRemaining = useMemo(
    () =>
      usableEntitlements.reduce(
        (sum, entitlement) => sum + Number(entitlement.releasesRemaining || 0),
        0
      ),
    [usableEntitlements]
  );

  // FAZ UX — Step 8 status uses its own model derived from readiness +
  // entitlement + lock state; it can never be auto-COMPLETE. LOCKED is derived
  // from a real completed release (the entitlement bound to this case reports
  // releasesCount > 0), never from client UI state.
  const hasSealedRelease = currentReleasesCount > 0;
  const lockedReportId = hasSealedRelease ? "SEALED_RELEASE" : null;
  const lockState: "IDLE" | "LOCKING" | "LOCKED" | "LOCK_FAILED" = sealing
    ? "LOCKING"
    : sealTone === "error" && sealStatus
      ? "LOCK_FAILED"
      : hasSealedRelease
        ? "LOCKED"
        : "IDLE";

  // Non-interactive header save indicator. It never performs a save itself;
  // the single manual save control lives in the fixed footer.
  const saveIndicatorText = saving
    ? "Saving…"
    : saveTone === "error" && saveStatus
      ? "Save failed"
      : saveTone === "success" && saveStatus
        ? "Saved"
        : "Unsaved changes";

  const step8Status = useMemo(
    () =>
      deriveStep8Status({
        isEligibleForSealing: readiness.isEligibleForSealing,
        criticalBlockerCount: readiness.criticalBlockers.length,
        hasEntitlement: usableEntitlements.length > 0,
        lockState,
        lockedReportId,
      }),
    [readiness, usableEntitlements, lockState, lockedReportId]
  );

  const unlockablePacks = packsUnlockableFromCredits(availableCredits);

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
      navigateToStep(1);
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
          selectedMethod: topic === "PRECURSOR_SCOPE" ? "No applicable precursors identified" : topic === "SYSTEM_BOUNDARY" ? "System boundary per installation monitoring plan and process map" : "Documented operator method",
          reason: "Operator assessment recorded for independent verifier challenge.",
          legalOrTechnicalBasis: "Regulation (EU) 2023/956, Annex IV and active definitive-period ruleset.",
          evidenceIds: [],
          // FAZ P0 — a user-created decision is never ACCEPTED. ACCEPTED is
          // granted only by the server-controlled review workflow.
          reviewStatus: "REVIEW_REQUIRED",
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
        reviewerNotes: reviewNotes[evidenceId] || "Organisation review completed.",
      });
      setCaseData(updated);
      setEvidenceStatus(`Evidence ${decision.toLowerCase()} under your organisation's review.`);
    } catch (error) {
      console.error("Evidence review failed", error);
      setEvidenceStatus(errorMessage(error));
    }
  };

  // FAZ 13 — the customer organisation manages its own in-org reviewers
  // (peer-to-peer approval). Self-approval stays blocked server-side.
  const handleSaveOrganisationId = async () => {
    setOrganisationStatus("");
    const trimmed = myOrganisationId.trim();
    if (!trimmed) {
      setOrganisationStatus("Enter an organisation identifier to join or create one.");
      return;
    }
    try {
      await updateOwnProfile({ organisationId: trimmed });
      setMyOrganisationId(trimmed);
      setOrganisationStatus(`Organisation "${trimmed}" saved. Share this identifier with reviewers so they can join, then assign them a review role.`);
    } catch (error) {
      setOrganisationStatus(errorMessage(error));
    }
  };

  const handleAssignReviewer = async () => {
    setOrganisationStatus("");
    const email = orgTargetEmail.trim().toLowerCase();
    if (!email) {
      setOrganisationStatus("Enter the reviewer's account email.");
      return;
    }
    setOrgAssigning(true);
    try {
      await assignOrganisationReviewer({ targetEmail: email }, orgTargetRole);
      setOrgTargetEmail("");
      setOrganisationStatus(`${orgTargetRole === "INTERNAL_REVIEWER" ? "Internal Reviewer" : "Data Owner"} role assigned to ${email}. They can now review this organisation's evidence and methodology decisions.`);
    } catch (error) {
      setOrganisationStatus(errorMessage(error));
    } finally {
      setOrgAssigning(false);
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
          rebateInformation: undefined,
          conversionMethod: undefined,
          independentCertificationEvidenceId: undefined,
        },
      ],
    }));
  };

  const focusReleaseCommand = () => {
    requestAnimationFrame(() => {
      releaseCommandRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleSeal = async () => {
    if (!caseData.caseId) return;
    const decision = evaluateSealAttempt({
      isEligibleForSealing: readiness.isEligibleForSealing,
      correctionRequired: currentReleasesCount > 0,
      correctionReason,
      entitlementId: usableEntitlements[0]?.entitlementId,
    });
    // FAZ UX — a blocked seal never changes the step, never navigates, never
    // consumes an entitlement and never touches payment. The blocker panel is
    // revealed in place and the user chooses the remediation step themselves.
    if (!decision.allowed) {
      if (decision.kind === "REVEAL_BLOCKERS") {
        revealSealBlockers();
        return;
      }
      if (decision.kind === "CORRECTION_REASON_REQUIRED") {
        setSealStatus("Correction reason is required and must be at least 10 characters long.");
        setSealTechnicalCode("CORRECTION_REASON_REQUIRED");
        setSealTone("warning");
        setSealProgress("ERROR");
        focusReleaseCommand();
        return;
      }
      setSealStatus(
        `This file is unpaid. Pay ${CANONICAL_PRICING.priceFormatted} to lock this working file first.`
      );
      setSealTechnicalCode("ENTITLEMENT_REQUIRED");
      setSealTone("warning");
      setSealProgress("ERROR");
      focusReleaseCommand();
      return;
    }
    if (!sealRequestId.current) sealRequestId.current = crypto.randomUUID();
    setSealProgress("VALIDATING");
    setSealing(true);
    setSealStatus("Validating the latest working-file data and payment status…");
    setSealTechnicalCode("");
    setSealTone("neutral");
    focusReleaseCommand();
    try {
      await persistDraft();
      setSealProgress("CREATING");
      setSealStatus("All checks passed. Creating your locked package and integrity manifest…");
      const response = await sealReport(
        caseData.caseId,
        decision.entitlementId,
        sealRequestId.current,
        correctionReason || undefined
      );
      const reportId = response.report?.reportId;
      if (!reportId) throw new Error("SEALED_REPORT_ID_MISSING");
      setSealProgress("SUCCESS");
      setSealStatus(STEP8_SEALED_SUCCESS_HEADLINE);
      setSealTone("success");
      router.push(`/cbam/reports/${reportId}`);
    } catch (error) {
      console.error("Sealing failed", error);
      const translated = translateSealError(error);
      setSealProgress("ERROR");
      setSealStatus(translated.userMessage);
      setSealTechnicalCode(translated.technicalCode);
      setSealTone("error");
      focusReleaseCommand();
    } finally {
      setSealing(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{wizardStepTitle(1)}</h2>
        <p className="mt-1 text-sm text-muted">{wizardStepDescription(1)}</p>
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
            <div key={path} data-field-path={path}>
              <FieldLabel helpKey={helpKey as FieldHelpKey}>{label}</FieldLabel>
              <input aria-label={label} aria-invalid={Boolean(fieldIssue(path))} type={type} value={datumValue(datum.value)} onChange={(event) => updateDatum(path, { value: event.target.value })} className={inputClass(path)} />
              <FieldError issue={fieldIssue(path)} />
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
        <h2 className="text-xl font-bold">{wizardStepTitle(2)}</h2>
        <p className="mt-1 text-sm text-muted">{wizardStepDescription(2)}</p>
      </div>
      {caseData.goods.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No goods declared.</div>}
      {caseData.goods.map((good, index) => (
        <div key={`good-${index}`} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
          <div data-field-path={`goods.${index}.cnCode`}><FieldLabel helpKey="cnCode">CN code</FieldLabel><input aria-label={`Good ${index + 1} CN code`} aria-invalid={Boolean(fieldIssue(`goods.${index}.cnCode`))} inputMode="numeric" value={datumValue(good.cnCode.value)} onChange={(event) => updateDatum(`goods.${index}.cnCode`, { value: event.target.value.replace(/\D/g, "").slice(0, 8) })} className={inputClass(`goods.${index}.cnCode`)} /><FieldError issue={fieldIssue(`goods.${index}.cnCode`)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.cnCode.source}</p></div>
          <div><FieldLabel helpKey="cbamSector">CBAM sector</FieldLabel><select aria-label={`Good ${index + 1} sector`} value={good.sector} onChange={(event) => updatePlain(`goods.${index}.sector`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{SECTORS.map((sector) => <option key={sector} value={sector}>{sector.replaceAll("_", " ")}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.cbamSector.source}</p></div>
          <div data-field-path={`goods.${index}.productionVolume`}><FieldLabel helpKey="productionQuantity">Production quantity</FieldLabel><DecimalInput ariaLabel={`Good ${index + 1} production quantity`} min="0" className={inputClass(`goods.${index}.productionVolume`)} value={datumValue(good.productionVolume.value)} onValueChange={(value) => updateDatum(`goods.${index}.productionVolume`, { value })} /><FieldError issue={fieldIssue(`goods.${index}.productionVolume`)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionQuantity.source}</p></div>
          <div><FieldLabel helpKey="productionUnit">Production unit</FieldLabel><select aria-label={`Good ${index + 1} production unit`} value={good.productionVolume.canonicalUnit || "t"} onChange={(event) => updateDatum(`goods.${index}.productionVolume`, { canonicalUnit: event.target.value as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="t">tonnes</option><option value="kg">kilograms</option></select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionUnit.source}</p></div>
          <div><FieldLabel helpKey="shipmentDescription">Shipment / product description</FieldLabel><input aria-label={`Good ${index + 1} shipment description`} value={datumValue(good.shipmentRecords.value)} onChange={(event) => updateDatum(`goods.${index}.shipmentRecords`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.shipmentDescription.source}</p></div>
          {caseData.goods.length > 1 && <div data-field-path={`goods.${index}.allocationShare`}><FieldLabel helpKey="allocationShare">Allocation share (0–1)</FieldLabel><DecimalInput ariaLabel={`Good ${index + 1} allocation share`} min="0" max="1" className={inputClass(`goods.${index}.allocationShare`)} value={datumValue(good.allocationShare?.value ?? null)} onValueChange={(value) => updateDatum(`goods.${index}.allocationShare`, { value, canonicalUnit: "fraction" })} /><FieldError issue={fieldIssue(`goods.${index}.allocationShare`)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.allocationShare.source}</p></div>}
          <button type="button" onClick={() => removeGood(index)} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove good</button>
        </div>
      ))}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{wizardStepTitle(3)}</h2>
        <p className="mt-1 text-sm text-muted">{wizardStepDescription(3)}</p>
      </div>
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
        <div data-field-path="installation.name"><FieldLabel helpKey="installationName">Installation name</FieldLabel><input aria-label="Installation name" aria-invalid={Boolean(fieldIssue("installation.name"))} value={datumValue(caseData.installation.name.value)} onChange={(event) => updateDatum("installation.name", { value: event.target.value })} className={inputClass("installation.name")} /><FieldError issue={fieldIssue("installation.name")} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.installationName.source}</p></div>
        <div data-field-path="installation.country"><FieldLabel helpKey="installationCountry">Installation country</FieldLabel><input aria-label="Installation country" aria-invalid={Boolean(fieldIssue("installation.country"))} value={datumValue(caseData.installation.country.value)} onChange={(event) => updateDatum("installation.country", { value: event.target.value })} className={inputClass("installation.country")} /><FieldError issue={fieldIssue("installation.country")} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.installationCountry.source}</p></div>
        <div data-field-path="installation.productionRoute"><FieldLabel helpKey="productionRoute">Production route</FieldLabel><input aria-label="Production route" aria-invalid={Boolean(fieldIssue("installation.productionRoute"))} value={datumValue(caseData.installation.productionRoute.value)} onChange={(event) => updateDatum("installation.productionRoute", { value: event.target.value })} className={inputClass("installation.productionRoute")} /><FieldError issue={fieldIssue("installation.productionRoute")} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.productionRoute.source}</p></div>
        <div><FieldLabel helpKey="installationName">Monitoring plan ID</FieldLabel><input aria-label="Monitoring plan ID" value={datumValue(caseData.installation.monitoringPlanId?.value ?? null)} onChange={(event) => updateDatum("installation.monitoringPlanId", { value: event.target.value })} className={inputClass("installation.monitoringPlanId")} /><p className="mt-1 text-[11px] text-muted leading-normal">Identifier and version of the monitoring plan applied for this reporting period.</p></div>
        <div className="md:col-span-2" data-field-path="installation.systemBoundaries"><FieldLabel helpKey="systemBoundary">System-boundary statement</FieldLabel><textarea aria-label="System-boundary statement" aria-invalid={Boolean(fieldIssue("installation.systemBoundaries"))} value={caseData.installation.systemBoundaries || ""} onChange={(event) => updatePlain("installation.systemBoundaries", event.target.value)} rows={5} className={inputClass("installation.systemBoundaries")} /><FieldError issue={fieldIssue("installation.systemBoundaries")} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.systemBoundary.source}</p></div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <h3 className="font-bold">System-boundary support</h3>
        <p className="mt-1 text-xs text-muted">The boundary statement is only supported once it is backed by approved evidence (monitoring plan, installation permit/scope, process map or controlled statement) or by a server-reviewed accepted methodology decision.</p>
        <button type="button" onClick={() => addMethodologyDecision("SYSTEM_BOUNDARY")} className="mt-3 rounded border border-border bg-neutral-soft px-4 py-2 text-sm font-semibold">Record system-boundary methodology decision</button>
        {caseData.methodologyDecisions.filter((decision) => decision.topic === "SYSTEM_BOUNDARY").map((decision) => <div key={decision.decisionId} className="mt-3 rounded border border-border bg-neutral-soft p-3 text-sm"><strong>{decision.topic}</strong><p>{decision.selectedMethod}</p><p className="text-xs text-muted">{decision.reviewStatus} · {decision.rulesetVersion}{decision.reviewStatus === "ACCEPTED" ? ` · approved by ${decision.approverName || "organisation review"}` : " · awaiting your organisation's review — ACCEPTED is granted only by your own reviewer"}</p></div>)}
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
      <div data-field-path={path}><FieldLabel helpKey={helpKey}>{label}</FieldLabel><DecimalInput ariaLabel={label} min="0" max={isGridFactor ? GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH : undefined} className={inputClass(path)} placeholder={isGridFactor ? "0.4344" : undefined} value={datumValue(datum.value)} onValueChange={(value) => updateDatum(path, { value })} /><FieldError issue={fieldIssue(path)} />{isGridFactor && Number(datum.value) > Number(GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH) && <p role="alert" className="mt-2 text-xs font-semibold text-status-blocked">Value exceeds 5 tCO2e/MWh. Check the source unit and decimal separator before continuing.</p>}<p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData[helpKey]?.source}</p></div>
      <div><FieldLabel helpKey="emissionsUnit">Unit</FieldLabel><select aria-label={`${label} unit`} value={datum.canonicalUnit || unit} onChange={(event) => updateDatum(path, { canonicalUnit: event.target.value as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm"><option value={unit}>{unit}</option></select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.emissionsUnit.source}</p></div>
      <div><FieldLabel helpKey="sourceType">Source type</FieldLabel><select aria-label={`${label} source type`} value={datum.sourceType} onChange={(event) => updateDatum(path, { sourceType: event.target.value as InputDatum["sourceType"] })} className="w-full rounded border border-border bg-background p-2 text-sm">{SOURCE_TYPES.map((source) => <option key={source} value={source}>{source}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.sourceType.source}</p></div>
    </div>;
  };

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{wizardStepTitle(4)}</h2>
        <p className="mt-1 text-sm text-muted">{wizardStepDescription(4)}</p>
      </div>
      {emissionInput("directEmissions", "Total direct emissions", "tCO2e", "directEmissions")}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">{wizardStepTitle(5)}</h2>
        <p className="mt-1 text-sm text-muted">{wizardStepDescription(5)}</p>
      </div>
      {emissionInput("electricityConsumed", "Electricity consumed", "MWh", "electricityConsumed")}
      {emissionInput("gridEmissionFactor", "Grid emission factor", "tCO2e/MWh", "gridEmissionFactor")}
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{wizardStepTitle(6)}</h2>
        <p className="mt-1 text-sm text-muted">{wizardStepDescription(6)}</p>
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
      {caseData.precursors.length === 0 && <button type="button" onClick={() => addMethodologyDecision("PRECURSOR_SCOPE")} className="rounded border border-border bg-surface px-4 py-3 text-sm">Record no-precursor scope decision (server review required before it becomes accepted)</button>}
      {caseData.precursors.map((precursor, index) => <div key={`precursor-${index}`} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        {[["name", "Precursor name", "precursorName"], ["countryOfOrigin", "Country of origin", "precursorCountry"]].map(([field, label, helpKey]) => <div key={field} data-field-path={`precursors.${index}.${field}`}><FieldLabel helpKey={helpKey as FieldHelpKey}>{label}</FieldLabel><input aria-label={`Precursor ${index + 1} ${label}`} aria-invalid={Boolean(fieldIssue(`precursors.${index}.${field}`))} value={datumValue(precursor[field as "name" | "countryOfOrigin"].value)} onChange={(event) => updateDatum(`precursors.${index}.${field}`, { value: event.target.value })} className={inputClass(`precursors.${index}.${field}`)} /><FieldError issue={fieldIssue(`precursors.${index}.${field}`)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData[helpKey as FieldHelpKey]?.source}</p></div>)}
        {[["quantity", "Quantity", "t", "precursorQuantity"], ["directEmissions", "Direct emissions", "tCO2e", "precursorDirectEmissions"], ["indirectEmissions", "Indirect emissions", "tCO2e", "precursorIndirectEmissions"]].map(([field, label, unit, helpKey]) => <div key={field} data-field-path={`precursors.${index}.${field}`}><FieldLabel helpKey={helpKey as FieldHelpKey}>{label} ({unit})</FieldLabel><DecimalInput ariaLabel={`Precursor ${index + 1} ${label}`} min="0" className={inputClass(`precursors.${index}.${field}`)} value={datumValue(precursor[field as "quantity" | "directEmissions" | "indirectEmissions"].value)} onValueChange={(value) => updateDatum(`precursors.${index}.${field}`, { value, canonicalUnit: unit as UnitCode })} /><FieldError issue={fieldIssue(`precursors.${index}.${field}`)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData[helpKey as FieldHelpKey]?.source}</p></div>)}
        <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, precursors: previous.precursors.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove precursor</button>
      </div>)}
      {caseData.goods.length > 1 && <button type="button" onClick={() => addMethodologyDecision("GOODS_EMISSIONS_ALLOCATION")} className="rounded border border-border bg-surface px-4 py-3 text-sm">Record allocation methodology (server review required before it becomes accepted)</button>}
      <div className="space-y-2">{caseData.methodologyDecisions.map((decision) => <div key={decision.decisionId} className="rounded border border-border bg-neutral-soft p-3 text-sm"><strong>{decision.topic}</strong><p>{decision.selectedMethod}</p><p className="text-xs text-muted">{decision.reviewStatus} · {decision.rulesetVersion}{decision.reviewStatus === "ACCEPTED" ? ` · approved by ${decision.approverName || "organisation review"}` : " · awaiting your organisation's review — ACCEPTED is granted only by your own reviewer"}</p></div>)}</div>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">{wizardStepTitle(7)}</h2>
        <p className="mt-1 text-sm text-muted">{wizardStepDescription(7)}</p>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Carbon price records</h3>
        <button type="button" onClick={addCarbonPriceRecord} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-sm"><Plus className="h-4 w-4" /> Add carbon-price record</button>
      </div>
      {caseData.carbonPriceRecords.map((record, index) => <div key={record.id} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        <div data-field-path={`carbonPriceRecords.${index}.amountPaid`}><FieldLabel helpKey="carbonPriceAmountPaid">Amount paid</FieldLabel><DecimalInput ariaLabel={`Carbon price ${index + 1} amount paid`} min="0" className={inputClass(`carbonPriceRecords.${index}.amountPaid`)} value={record.amountPaid} onValueChange={(value) => updatePlain(`carbonPriceRecords.${index}.amountPaid`, value)} /><FieldError issue={fieldIssue(`carbonPriceRecords.${index}.amountPaid`)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceAmountPaid.source}</p></div>
        <div data-field-path={`carbonPriceRecords.${index}.applicableEmissions`}><FieldLabel helpKey="carbonPriceApplicableEmissions">Applicable emissions</FieldLabel><DecimalInput ariaLabel={`Carbon price ${index + 1} applicable emissions`} min="0" className={inputClass(`carbonPriceRecords.${index}.applicableEmissions`)} value={record.applicableEmissions} onValueChange={(value) => updatePlain(`carbonPriceRecords.${index}.applicableEmissions`, value)} /><FieldError issue={fieldIssue(`carbonPriceRecords.${index}.applicableEmissions`)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceApplicableEmissions.source}</p></div>
        <div data-field-path={`carbonPriceRecords.${index}.eligibleCertificateReduction`}><FieldLabel helpKey="carbonPriceEligibleCertificateReduction">Eligible certificate reduction (tCO2e)</FieldLabel><DecimalInput ariaLabel={`Carbon price ${index + 1} eligible certificate reduction`} min="0" className={inputClass(`carbonPriceRecords.${index}.eligibleCertificateReduction`)} value={record.eligibleCertificateReduction} onValueChange={(value) => updatePlain(`carbonPriceRecords.${index}.eligibleCertificateReduction`, value)} /><FieldError issue={fieldIssue(`carbonPriceRecords.${index}.eligibleCertificateReduction`)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceEligibleCertificateReduction.source}</p></div>
        <div><FieldLabel helpKey="carbonPriceCurrency">Currency</FieldLabel><select aria-label={`Carbon price ${index + 1} currency`} value={record.currency} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.currency`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{["EUR", "USD", "GBP", "TRY"].map((currency) => <option key={currency}>{currency}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceCurrency.source}</p></div>
        <div><FieldLabel helpKey="legislationReference">Legislation reference</FieldLabel><input aria-label={`Carbon price ${index + 1} legislation reference`} value={record.legislationReference} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.legislationReference`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.legislationReference.source}</p></div>
        <div><FieldLabel helpKey="carbonPriceRebateInformation">Rebate information</FieldLabel><input aria-label={`Carbon price ${index + 1} rebate information`} value={record.rebateInformation || ""} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.rebateInformation`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceRebateInformation.source}</p></div>
        <div><FieldLabel helpKey="carbonPriceConversionMethod">Conversion method</FieldLabel><input aria-label={`Carbon price ${index + 1} conversion method`} value={record.conversionMethod || ""} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.conversionMethod`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceConversionMethod.source}</p></div>
        <div className="md:col-span-2"><FieldLabel helpKey="paymentEvidence">Payment evidence</FieldLabel><select aria-label={`Carbon price ${index + 1} payment evidence`} value={record.proofOfPaymentEvidenceId || ""} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.proofOfPaymentEvidenceId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">Select evidence</option>{caseData.evidenceRegister.map((evidence) => <option key={evidence.evidenceId} value={evidence.evidenceId}>{evidence.fileName}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.paymentEvidence.source}</p></div>
        <div className="md:col-span-2"><FieldLabel helpKey="carbonPriceIndependentCertification">Independent certification evidence (optional)</FieldLabel><select aria-label={`Carbon price ${index + 1} independent certification evidence`} value={record.independentCertificationEvidenceId || ""} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.independentCertificationEvidenceId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">Select evidence</option>{caseData.evidenceRegister.map((evidence) => <option key={evidence.evidenceId} value={evidence.evidenceId}>{evidence.fileName}</option>)}</select><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.carbonPriceIndependentCertification.source}</p></div>
        <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, carbonPriceRecords: previous.carbonPriceRecords.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-status-blocked md:col-span-2"><Trash2 className="h-4 w-4" /> Remove carbon-price record</button>
      </div>)}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6"><h3 className="font-bold">Upload immutable evidence</h3><div className="grid gap-4 md:grid-cols-2">
        <div><FieldLabel helpKey="evidenceFile">File</FieldLabel><input aria-label="Evidence file" type="file" accept=".pdf,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceFile.source}</p></div>
        <div><FieldLabel helpKey="evidenceDocumentType">Document type</FieldLabel><input aria-label="Evidence document type" value={evidenceDocumentType} onChange={(event) => setEvidenceDocumentType(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceDocumentType.source}</p></div>
        <div><FieldLabel helpKey="evidenceIssuer">Issuer</FieldLabel><input aria-label="Evidence issuer" value={evidenceIssuer} onChange={(event) => setEvidenceIssuer(event.target.value)} placeholder="Example: electricity supplier or installation operator" className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceIssuer.source}</p></div>
        <div><FieldLabel helpKey="evidenceIssueDate">Issue date</FieldLabel><input aria-label="Evidence issue date" type="date" value={evidenceIssueDate} onChange={(event) => setEvidenceIssueDate(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" /><p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceIssueDate.source}</p></div>
        <div className="md:col-span-2"><FieldLabel helpKey="evidenceLinkedInput">Linked input</FieldLabel><select aria-label="Evidence linked input" value={evidenceLinkedInput} onChange={(event) => setEvidenceLinkedInput(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="" disabled>Select the input this document supports…</option>{linkOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{(() => { const selected = linkOptions.find((option) => option.value === evidenceLinkedInput); if (!selected) return null; return <div className="mt-2 rounded border border-border bg-neutral-soft p-3 text-xs leading-relaxed text-muted"><strong>Accepted evidence:</strong> {selected.acceptedEvidenceTypes.join(", ") || "Source document"}<br /><strong>Preferred issuers:</strong> {selected.preferredIssuerCategories.join(", ") || "Any"}<br />{selected.required ? <span className="text-status-warning">This input requires at least one internally approved evidence record before sealing.</span> : <span>Optional support document.</span>}</div>; })()}<p className="mt-1 text-[11px] text-muted leading-normal">{fieldHelpData.evidenceLinkedInput.source}</p></div>
      </div><button type="button" onClick={handleEvidenceUpload} disabled={uploading} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload and register evidence</button><StatusBanner status={evidenceStatus} tone={evidenceStatus.toLowerCase().includes("failed") || evidenceStatus.includes("EVIDENCE_") ? "error" : "warning"} /></div>

      <div className="space-y-3">{caseData.evidenceRegister.map((evidence) => <div key={evidence.evidenceId} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{evidence.fileName}</p><p className="text-xs text-muted">{evidence.documentType} · {evidence.sizeBytes} bytes · {humanizeEvidenceStatus(evidence.reviewStatus, evidence.supportStatus, evidence.malwareScanStatus)}</p><p className="mt-1 text-xs text-muted">Linked inputs: {evidence.linkedInputs.length > 0 ? evidence.linkedInputs.join(", ") : "none"}</p><p className="mt-1 text-xs text-muted">Quality grade (derived from structured issuer metadata, not issuer wording): <strong>{gradeEvidenceRecord(evidence)}</strong>{evidence.qualityAssessedBy ? ` · assessed by ${evidence.qualityAssessedBy}` : ""}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">SHA-256 {evidence.fileHash}</p></div></div><div className="mt-3"><FieldLabel helpKey="evidenceReviewNotes">Organisation review note</FieldLabel><div className="flex flex-col gap-2 md:flex-row"><input aria-label={`Review notes for ${evidence.fileName}`} value={reviewNotes[evidence.evidenceId] || ""} onChange={(event) => setReviewNotes((previous) => ({ ...previous, [evidence.evidenceId]: event.target.value }))} placeholder="Organisation review note" className="flex-1 rounded border border-border bg-background p-2 text-sm" /><button type="button" disabled={evidence.malwareScanStatus !== "CLEAN"} onClick={() => handleEvidenceReview(evidence.evidenceId, "APPROVED")} className="rounded bg-status-pass px-3 py-2 text-xs font-semibold text-surface-elevated disabled:opacity-40">Request approval</button><button type="button" onClick={() => handleEvidenceReview(evidence.evidenceId, "REJECTED")} className="rounded bg-status-blocked px-3 py-2 text-xs font-semibold text-surface-elevated">Reject</button></div></div><div className="mt-2 grid gap-2 md:grid-cols-2"><select aria-label={`Link ${evidence.fileName} to an additional input`} value="" onChange={(event) => { const value = event.target.value; if (!value) return; setCaseData((previous) => ({ ...previous, evidenceRegister: previous.evidenceRegister.map((record) => record.evidenceId === evidence.evidenceId && !record.linkedInputs.includes(value) ? { ...record, linkedInputs: [...record.linkedInputs, value] } : record) })); }} className="w-full rounded border border-border bg-background p-2 text-xs"><option value="">Link to additional input…</option>{linkOptions.filter((option) => !evidence.linkedInputs.includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>{evidence.malwareScanStatus !== "CLEAN" && <p className="mt-2 text-xs text-status-warning">Approval is disabled until an external malware scan is recorded as CLEAN.</p>}<p className="mt-2 text-[11px] text-muted">Approval and quality grades are assigned through your organisation&apos;s review workflow only. The uploading user cannot self-approve a document or assign A/B/C/D/E grades.</p></div>)}</div>

      <div className="rounded-xl border border-border bg-surface p-5" data-testid="organisation-review-panel">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-accent" />
          <h3 className="font-bold">Your organisation&apos;s reviewers</h3>
        </div>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Review is controlled by your own organisation, not by CBAMValid personnel. Set an organisation
          identifier, ask a colleague to use the same identifier in their account settings, then assign them a
          review role here. That reviewer can approve evidence and accept methodology decisions so the dossier
          can be sealed — while the case owner can never approve their own documents.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-neutral-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Organisation identifier</p>
            {myOrganisationId ? (
              <p className="mt-2 text-sm font-semibold break-all">{myOrganisationId}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">Not set yet.</p>
            )}
            <div className="mt-3 flex gap-2">
              <input
                aria-label="Organisation identifier"
                value={myOrganisationId}
                onChange={(event) => setMyOrganisationId(event.target.value)}
                placeholder="e.g. acme-steel-2026"
                className="min-w-0 flex-1 rounded border border-border bg-background p-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveOrganisationId}
                className="shrink-0 rounded bg-accent px-3 py-2 text-xs font-semibold text-surface"
              >
                Save
              </button>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-neutral-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Assign a reviewer role</p>
            <p className="mt-2 text-xs text-muted">Your role: <strong>{myRole || "USER"}</strong>. The target must already use the same organisation identifier.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Reviewer account email"
                type="email"
                value={orgTargetEmail}
                onChange={(event) => setOrgTargetEmail(event.target.value)}
                placeholder="reviewer@example.com"
                className="min-w-0 flex-1 rounded border border-border bg-background p-2 text-sm"
              />
              <select
                aria-label="Reviewer role"
                value={orgTargetRole}
                onChange={(event) => setOrgTargetRole(event.target.value as "INTERNAL_REVIEWER" | "DATA_OWNER")}
                className="shrink-0 rounded border border-border bg-background p-2 text-sm"
              >
                <option value="INTERNAL_REVIEWER">Internal Reviewer</option>
                <option value="DATA_OWNER">Data Owner</option>
              </select>
              <button
                type="button"
                onClick={handleAssignReviewer}
                disabled={orgAssigning}
                className="shrink-0 rounded bg-status-pass px-3 py-2 text-xs font-semibold text-surface-elevated disabled:opacity-50"
              >
                {orgAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign role"}
              </button>
            </div>
          </div>
        </div>
        {organisationStatus && <StatusBanner status={organisationStatus} tone={organisationStatus.toLowerCase().includes("failed") || organisationStatus.includes("_") ? "error" : "success"} />}
      </div>
    </div>
  );

  const renderStep8 = () => {
    const blockerCount = readiness.criticalBlockers.length;
    const documentsToUpload = step8Actions.filter((item) => item.category === "Documents to upload").length;
    const awaitingReview = step8Actions.filter((item) => item.category === "Documents awaiting review").length;
    const methodologyPending = step8Actions.filter((item) => item.category === "Methodology decisions awaiting approval").length;
    const calculationIssues = step8Actions.filter((item) => item.category === "Calculation inconsistencies").length;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">{STEP8_FINAL_TITLE}</h2>
          <p className="mt-1 text-sm text-muted">{STEP8_FINAL_SUPPORTING_TEXT}</p>
        </div>

        <section
          ref={releaseCommandRef}
          aria-label="Lock and download center"
          aria-live="polite"
          aria-busy={sealing}
          className={`scroll-mt-24 rounded-2xl border-2 p-5 shadow-sm md:p-6 ${
            step8Status === "BLOCKED"
              ? "border-status-blocked/40 bg-[color:var(--status-blocked-soft)]"
              : step8Status === "PAYMENT_REQUIRED"
                ? "border-status-warning/40 bg-[color:var(--status-warning-soft)]"
                : step8Status === "LOCK_FAILED"
                  ? "border-status-blocked/40 bg-surface"
                  : "border-accent/40 bg-surface"
          }`}
        >
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Lock and download</p>
              <h3 className="mt-2 font-serif text-2xl font-bold">
                {step8Status === "BLOCKED"
                  ? "Resolve the remaining requirements"
                  : step8Status === "PAYMENT_REQUIRED"
                    ? "Authorize this working file"
                    : step8Status === "LOCKING"
                      ? "Package creation is in progress"
                      : step8Status === "LOCK_FAILED"
                        ? "The previous attempt did not complete"
                        : step8Status === "LOCKED"
                          ? "Your locked package is ready"
                          : "Ready to create your locked package"}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step8Status === "BLOCKED"
                  ? `${readiness.criticalBlockers.length} open requirement${readiness.criticalBlockers.length === 1 ? "" : "s"} must be resolved first. No payment is taken and nothing is locked.`
                  : step8Status === "PAYMENT_REQUIRED"
                    ? `All preparation checks passed. Pay ${CANONICAL_PRICING.priceFormatted} once to authorize this working file before creating your package.`
                    : step8Status === "LOCKING"
                      ? "Keep this page open. The system is validating your saved data, checking payment and generating the signed package."
                      : step8Status === "LOCK_FAILED"
                        ? "Your draft is safe and the same protected request can be retried. The technical reason is shown below without hiding the next action."
                        : "All preparation checks and payment are confirmed. One action creates your locked package and opens its download page."}
              </p>
            </div>
            <Step8StateBadge status={step8Status} />
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Package creation progress">
            {[
              { label: "1. Validate", detail: "Saved working file + payment", active: sealProgress === "VALIDATING", done: ["CREATING", "SUCCESS"].includes(sealProgress) },
              { label: "2. Create", detail: "Reports + manifest + signature", active: sealProgress === "CREATING", done: sealProgress === "SUCCESS" },
              { label: "3. Open", detail: "Locked package and downloads", active: sealProgress === "SUCCESS", done: sealProgress === "SUCCESS" },
            ].map((phase) => (
              <div
                key={phase.label}
                className={`rounded-lg border p-3 ${phase.done ? "border-forest-light bg-forest-pale" : phase.active ? "border-accent bg-accent/5" : "border-border bg-neutral-soft"}`}
              >
                <p className="text-xs font-bold">{phase.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{phase.detail}</p>
              </div>
            ))}
          </div>

          {sealStatus && <div className="mt-4"><StatusBanner status={sealStatus} tone={sealTone} /></div>}
          {sealTechnicalCode && (
            <details className="mt-3 rounded-lg border border-border bg-neutral-soft p-3">
              <summary className="cursor-pointer text-xs font-semibold">Technical details</summary>
              <p className="mt-2 break-all font-mono text-[10px] text-muted">{sealTechnicalCode}</p>
            </details>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Click once. Duplicate submissions are protected automatically; failed or blocked attempts are never charged.
          </p>
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

        {/* 1. Four status cards — Operator preparation · Evidence assurance · Package integrity · External verifier */}
        <section aria-label="Final review status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Operator preparation</p>
            <p className="mt-1 text-2xl font-bold">{readiness.completenessPercentage}%</p>
            <p className="mt-1 text-xs text-muted">{readiness.passedControls}/{readiness.applicableControls} automated controls passed</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Evidence assurance</p>
            <p className="mt-1 text-2xl font-bold">{evidenceAssurance.score}%</p>
            <p className="mt-1 text-xs text-muted">{evidenceAssurance.approvedCount}/{evidenceAssurance.total} documents approved, supported and clean{evidenceAssurance.pendingCount > 0 ? ` · ${evidenceAssurance.pendingCount} pending` : ""}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Package readiness</p>
            <p className={`mt-1 text-sm font-bold ${readiness.isEligibleForSealing ? "text-forest" : "text-status-blocked"}`}>{readiness.isEligibleForSealing ? "READY" : "NOT READY"}</p>
            <p className="mt-1 text-xs text-muted">
              {readiness.isEligibleForSealing
                ? "Every automated control passed"
                : `${blockerCount} open item${blockerCount === 1 ? "" : "s"} remain${blockerCount === 1 ? "s" : ""}`}
            </p>
            {scenarioActive && <p className="mt-1 text-xs text-status-warning">Illustrative scenario values cannot be sealed.</p>}
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Independent verification</p>
            <p className="mt-1 text-sm font-bold">POST-RELEASE</p>
            <p className="mt-1 text-xs text-muted">Begins after package creation and does not block the operator working-file release.</p>
          </div>
        </section>

        {/* 2. Remaining actions — single CTA, revealed in place, never auto-navigates */}
        <section ref={blockerPanelRef} aria-label="Remaining actions" className={`scroll-mt-4 rounded-xl border p-5 ${showBlockers ? "border-status-blocked/40 bg-[color:var(--status-blocked-soft)]" : "border-border bg-surface"}`}>
          <h3 className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5 text-status-blocked" /> Remaining actions</h3>
          <p className="mt-1 text-xs text-muted">
            {blockerCount} open item{blockerCount === 1 ? "" : "s"} · {documentsToUpload} document{documentsToUpload === 1 ? "" : "s"} to upload · {awaitingReview} document{awaitingReview === 1 ? "" : "s"} awaiting review · {methodologyPending} methodology decision{methodologyPending === 1 ? "" : "s"} awaiting approval{calculationIssues > 0 ? ` · ${calculationIssues} calculation issue${calculationIssues === 1 ? "" : "s"}` : ""}
          </p>
          {readiness.isEligibleForSealing ? (
            <div className="mt-4 rounded-lg border border-forest-pale bg-forest-pale p-4 text-sm text-forest"><CheckCircle2 className="mb-2 h-5 w-5" /> Every automated preparation control has passed. Use Lock and download above to create the package.</div>
          ) : (
            <button
              type="button"
              onClick={revealSealBlockers}
              className="mt-4 inline-flex items-center gap-2 rounded border border-status-blocked/50 bg-surface px-4 py-2 text-sm font-semibold text-status-blocked"
            >
              <AlertTriangle className="h-4 w-4" /> {STEP8_REVIEW_ACTIONS_LABEL}
            </button>
          )}
          {showBlockers && (
            <div className="mt-4 space-y-3">
              {(() => {
                const remainingItems = [
                  ...readiness.allGaps.map((gap) => {
                    const resolution = gapResolution(gap);
                    return {
                      id: gap.gapId,
                      category: "Requirement",
                      fieldLabel: gap.requirement,
                      problem: "Open requirement",
                      why: gap.whyItMatters,
                      acceptedDocuments: resolution.evidence,
                      currentStatus: "Missing",
                      responsibleParty: "Operator",
                      step: resolution.step,
                      action: resolution.action,
                    };
                  }),
                  ...step8Actions.map((item) => ({
                    id: `${item.category}-${item.fieldPath}`,
                    category: item.category,
                    fieldLabel: item.fieldLabel,
                    problem: item.category,
                    why: item.why,
                    acceptedDocuments: item.acceptedDocuments,
                    currentStatus:
                      item.category === "Documents awaiting review"
                        ? "Awaiting review"
                        : item.category === "Methodology decisions awaiting approval"
                          ? "Awaiting approval"
                          : item.category === "Calculation inconsistencies"
                            ? "Requires correction"
                            : "Missing",
                    responsibleParty:
                      item.category === "Documents awaiting review" || item.category === "Methodology decisions awaiting approval"
                        ? "Your organisation's reviewer"
                        : "Operator",
                    step: item.step,
                    action: "",
                  })),
                ];
                if (remainingItems.length === 0) {
                  return <p className="text-sm text-muted">No open action items were found by the automated review.</p>;
                }
                return (
                  <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1" aria-label="Seal blocker remediation plan">
                    {remainingItems.map((item, index) => (
                      <article key={item.id} className="rounded-lg border border-border bg-surface p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="rounded-full border border-border bg-neutral-soft px-2.5 py-0.5 text-[11px] font-bold">{item.category}</span>
                          <button
                            type="button"
                            data-testid={index === 0 ? "first-blocker-action" : undefined}
                            onClick={() => goToStep(item.step)}
                            className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-accent underline underline-offset-2"
                          >
                            Go to step {item.step} <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                        <h4 className="mt-2 font-semibold">{item.fieldLabel}</h4>
                        <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-2">
                          <div><dt className="font-semibold text-foreground">Problem</dt><dd>{item.problem}</dd></div>
                          <div><dt className="font-semibold text-foreground">Why needed</dt><dd>{item.why}</dd></div>
                          <div><dt className="font-semibold text-foreground">Accepted document</dt><dd>{item.acceptedDocuments}</dd></div>
                          <div><dt className="font-semibold text-foreground">Current status</dt><dd>{item.currentStatus}</dd></div>
                          <div><dt className="font-semibold text-foreground">Responsible party</dt><dd>{item.responsibleParty}</dd></div>
                          <div><dt className="font-semibold text-foreground">Fix in</dt><dd>Step {item.step}</dd></div>
                        </dl>
                        {item.action && <p className="mt-2 text-xs text-muted"><strong className="text-foreground">How to fix:</strong> {item.action}</p>}
                      </article>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </section>

        {/* 3. Payment and release — payment and readiness shown separately */}
        <section aria-label="Payment and release" className="rounded-xl border border-border bg-surface p-5">
          <h3 className="flex items-center gap-2 font-bold"><LockKeyhole className="h-5 w-5 text-accent" /> Payment and release</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className={`rounded-lg border p-4 ${usableEntitlements.length > 0 ? "border-forest-light bg-forest-pale" : "border-status-warning/40 bg-[color:var(--status-warning-soft)]"}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Payment</p>
              <p className={`mt-1 text-sm font-bold ${usableEntitlements.length > 0 ? "text-forest" : "text-status-warning"}`}>
                {usableEntitlements.length > 0 ? "READY" : "PAYMENT REQUIRED"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {usableEntitlements.length > 0
                  ? "This working file has an available release."
                  : "Pay once to unlock this working file. Failed or blocked locks charge nothing."}
              </p>
            </div>
            <div className={`rounded-lg border p-4 ${readiness.isEligibleForSealing ? "border-forest-light bg-forest-pale" : "border-status-blocked/40 bg-[color:var(--status-blocked-soft)]"}`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Preparation</p>
              <p className={`mt-1 text-sm font-bold ${readiness.isEligibleForSealing ? "text-forest" : "text-status-blocked"}`}>
                {readiness.isEligibleForSealing ? "Ready" : "Not ready"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {readiness.isEligibleForSealing
                  ? "Every automated preparation check has passed."
                  : `${blockerCount} open item${blockerCount === 1 ? "" : "s"} remain${blockerCount === 1 ? "s" : ""}. Review the remaining actions above.`}
              </p>
            </div>
          </div>

          {currentReleasesCount > 0 && (
            <div className="mt-4">
              <FieldLabel helpKey="correctionReason">Correction reason (required for this lock — lock #{currentReleasesCount + 1})</FieldLabel>
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

          <p className="mt-4 text-xs text-muted">
            Payment is for this working file only. Failed or blocked attempts charge nothing. Re-download is free. The current status and next action are shown in Lock and download above.
          </p>
        </section>

        {/* 4. Package preview — never claims a sealed release before one exists */}
        <section aria-label="Package preview" className="rounded-xl border border-border-strong bg-dark p-6 text-surface-elevated shadow-sm">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h3 className="flex items-center gap-2 text-xl font-bold"><PackageCheck className="h-6 w-6" /> {STEP8_PACKAGE_PREVIEW_HEADLINE}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-dark-text/80">Once you lock and pay, the package is created from your data after every preparation check passes, producing a verifier-ready, tamper-proof release.</p>
            </div>
            <span className="shrink-0 rounded-full border border-border-strong px-3 py-1 text-xs font-semibold">25 package components</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {SEALED_PACKAGE_HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return <article key={item.title} className="rounded-lg border border-border-strong bg-dark p-4"><Icon className="h-5 w-5 text-seal" /><h4 className="mt-3 text-sm font-bold">{item.title}</h4><p className="mt-1 text-xs leading-relaxed text-dark-text/80">{item.detail}</p></article>;
            })}
          </div>
          <ul className="mt-4 grid gap-1.5 text-xs text-dark-text/80 sm:grid-cols-2">
            <li>11 professional PDF reports and annexes</li>
            <li>Verifier spreadsheet with sign-off</li>
            <li>25 package components</li>
            <li>Data-integrity manifest</li>
            <li>Digital signature and tamper-proof release hash</li>
            <li>Offline verifier review layout</li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">Professional boundary: CBAMValid prepares the operator dossier and evidence chain. Only an appropriately accredited independent verifier can issue a verification opinion.</p>
        </section>

        {/* 5. Emissions summary + advanced technical details (closed by default) */}
        <section aria-label="Emissions summary" className="rounded-xl border border-border bg-surface p-5">
          <h3 className="flex items-center gap-2 font-bold"><FileCode2 className="h-5 w-5 text-accent" /> Emissions summary</h3>
          {calculation.error ? <div className="mt-4"><StatusBanner status={calculation.error} tone="warning" /></div> : (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-border bg-neutral-soft p-3"><span className="text-xs text-muted">Total embedded emissions</span><strong className="block text-lg">{calculation.result?.totalEmbeddedEmissions} tCO2e</strong></div>
                <div className="rounded-lg border border-border bg-neutral-soft p-3"><span className="text-xs text-muted">Direct emissions</span><strong className="block text-lg">{calculation.result?.totalDirectEmissions} tCO2e</strong></div>
                <div className="rounded-lg border border-border bg-neutral-soft p-3"><span className="text-xs text-muted">Indirect emissions</span><strong className="block text-lg">{calculation.result?.totalIndirectEmissions} tCO2e</strong></div>
                <div className="rounded-lg border border-border bg-neutral-soft p-3"><span className="text-xs text-muted">Precursor emissions</span><strong className="block text-lg">{calculation.result?.totalPrecursorEmissions} tCO2e</strong></div>
                <div className="rounded-lg border border-border bg-neutral-soft p-3"><span className="text-xs text-muted">Allocation check</span><strong className="block text-lg">{calculation.result?.allocationReconciliationDelta}</strong></div>
              </div>
              {calculation.result && numeric(calculation.result.totalEmbeddedEmissions) > 0 && (
                <div className="mt-5 rounded-lg border border-border bg-neutral-soft p-4" aria-label="Emissions composition chart">
                  <div className="flex items-center justify-between text-xs"><strong>Emissions composition</strong><span className="text-muted">tCO2e</span></div>
                  <div className="mt-3 flex h-8 overflow-hidden rounded-md bg-surface-secondary" title="Direct, electricity and precursor emissions">
                    <div className="bg-forest" style={{ width: `${percentOf(calculation.result.installationDirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} />
                    <div className="bg-forest-light" style={{ width: `${percentOf(calculation.result.electricityIndirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} />
                    <div className="bg-seal" style={{ width: `${percentOf(calculation.result.precursorDirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} />
                    <div className="bg-seal-light" style={{ width: `${percentOf(calculation.result.precursorIndirectEmissions, calculation.result.totalEmbeddedEmissions)}%` }} />
                  </div>
                  <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                    <span><i className="mr-2 inline-block h-2 w-2 bg-forest" />Installation direct {calculation.result.installationDirectEmissions}</span>
                    <span><i className="mr-2 inline-block h-2 w-2 bg-forest-light" />Electricity indirect {calculation.result.electricityIndirectEmissions}</span>
                    <span><i className="mr-2 inline-block h-2 w-2 bg-seal" />Precursor direct {calculation.result.precursorDirectEmissions}</span>
                    <span><i className="mr-2 inline-block h-2 w-2 bg-seal-light" />Precursor indirect {calculation.result.precursorIndirectEmissions}</span>
                  </div>
                </div>
              )}
              <div className="mt-4 rounded-lg border border-border bg-neutral-soft">
                <button
                  type="button"
                  onClick={() => setShowAdvancedDetails((previous) => !previous)}
                  aria-expanded={showAdvancedDetails}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
                >
                  Advanced calculation and integrity details
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedDetails ? "rotate-180" : ""}`} />
                </button>
                {showAdvancedDetails && (
                  <div className="border-t border-border px-4 py-3">
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><span className="text-muted">Aggregate intensity</span><strong className="block">{calculation.result?.specificEmbeddedEmissions} tCO2e/t</strong></div>
                      <div><span className="text-muted">Allocation total</span><strong className="block">{calculation.result?.allocationShareTotal}</strong></div>
                      <div><span className="text-muted">Allocation check</span><strong className="block">{calculation.result?.allocationReconciliationDelta}</strong></div>
                      <div><span className="text-muted">Ruleset</span><strong className="block text-xs">{caseData.methodologyDecisions[0]?.rulesetVersion || "EU-CBAM-DEFINITIVE-2026"}</strong></div>
                    </div>
                    <div className="mt-3 max-h-72 space-y-3 overflow-y-auto" aria-label="Calculation trace">
                      {calculation.result?.trace.map((trace) => (
                        <div key={trace.calculationId} className="rounded border border-border bg-surface p-3 font-mono text-xs">
                          <div className="font-bold text-accent">{trace.formulaId}</div>
                          <div>{String(trace.outputValue)} {trace.outputUnit}</div>
                          <div className="break-all text-[10px] text-muted">SHA-256 {trace.calculationHash}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    );
  };

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8][currentStep - 1];

  const stepRailEntry = (stepNumber: number) => {
    const validation = stepValidations[stepNumber];
    const state = stepStates[stepNumber];
    const active = stepNumber === currentStep;
    const ssot = getWorkflowStep(stepNumber);
    const isStep8 = stepNumber === 8;
    const status = isStep8 ? step8Status : state;
    const statusClass = isStep8
      ? STEP8_STATUS_STYLES[status as Step8Status]
      : STEP_STATE_STYLES[status as WizardStepperState];
    const complete = state === "COMPLETE" || (isStep8 && status === "LOCKED");
    return (
      <button
        type="button"
        key={stepNumber}
        onClick={() => goToStep(stepNumber)}
        aria-current={active ? "step" : undefined}
        className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
          active ? "border-accent bg-accent/10" : "border-border bg-surface hover:bg-neutral-soft"
        }`}
      >
        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          complete
            ? "bg-forest-pale text-forest"
            : active
              ? "bg-accent text-surface"
              : "bg-neutral-soft text-muted"
        }`}>
          {complete ? <CheckCircle2 className="h-4 w-4" /> : stepNumber}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">{ssot.shortTitle}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className={`rounded-full border px-1.5 py-px font-bold ${statusClass}`}>{isStep8 ? STEP8_STATUS_LABELS[status as Step8Status] : STEP_STATE_LABELS[status as WizardStepperState]}</span>
            {!isStep8 && validation.missingFieldCount > 0 && (
              <span className="font-semibold text-status-blocked">{validation.missingFieldCount} field{validation.missingFieldCount === 1 ? "" : "s"} missing</span>
            )}
            {!isStep8 && validation.missingEvidenceCount > 0 && (
              <span className="font-semibold text-status-warning">{validation.missingEvidenceCount} doc{validation.missingEvidenceCount === 1 ? "" : "s"} needed</span>
            )}
            {!isStep8 && validation.awaitingReviewCount > 0 && (
              <span className="font-semibold text-muted">{validation.awaitingReviewCount} awaiting review</span>
            )}
            {isStep8 && status === "PAYMENT_REQUIRED" && <span className="font-semibold text-status-warning">Payment required</span>}
            {isStep8 && status === "BLOCKED" && (
              <span className="font-semibold text-status-blocked">{readiness.criticalBlockers.length} open item{readiness.criticalBlockers.length === 1 ? "" : "s"}</span>
            )}
          </span>
        </span>
      </button>
    );
  };

  const renderFooterCta = () => {
    if (currentStep !== 8) {
      return (
        <button
          type="button"
          onClick={goToNext}
          className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded bg-accent px-3 py-2 text-sm font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground sm:flex-none sm:px-4"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      );
    }
    // FAZ UX — Step 8 has exactly one primary CTA, always in the fixed footer,
    // in the same screen position for every state. BLOCKED stays clickable and
    // reveals the blockers in place; payment and sealing are never invoked from
    // the blocked path.
    const ctaLabel = formatStep8CtaLabel(step8Status, {
      openItemCount: readiness.criticalBlockers.length,
      price: CANONICAL_PRICING.priceFormatted,
    });
    const ctaClass =
      "inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md bg-seal px-5 text-sm font-bold text-ink shadow-sm transition hover:bg-seal-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[300px] sm:flex-1";
    switch (step8Status) {
      case "BLOCKED":
        return (
          <button
            type="button"
            data-testid="step8-primary-action"
            onClick={revealSealBlockers}
            aria-haspopup="true"
            aria-expanded={showBlockers}
            className={ctaClass}
          >
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" /> {ctaLabel}
          </button>
        );
      case "PAYMENT_REQUIRED":
        return (
          <Link
            data-testid="step8-primary-action"
            href={`/credits/buy?caseId=${encodeURIComponent(caseData.caseId || "")}`}
            className={ctaClass}
          >
            <LockKeyhole className="h-5 w-5 shrink-0" aria-hidden="true" /> {ctaLabel}
          </Link>
        );
      case "READY_TO_LOCK":
        return (
          <button
            type="button"
            data-testid="step8-primary-action"
            onClick={handleSeal}
            disabled={sealing}
            aria-busy={sealing}
            className={ctaClass}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> {ctaLabel}
          </button>
        );
      case "LOCKING":
        return (
          <button type="button" data-testid="step8-primary-action" disabled aria-busy className={ctaClass}>
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" /> {ctaLabel}
          </button>
        );
      case "LOCKED":
        return (
          <Link data-testid="step8-primary-action" href="/reports" className={ctaClass}>
            {ctaLabel} <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
          </Link>
        );
      case "LOCK_FAILED":
        return (
          <button
            type="button"
            data-testid="step8-primary-action"
            onClick={handleSeal}
            disabled={sealing}
            aria-busy={sealing}
            className={ctaClass}
          >
            <LockKeyhole className="h-5 w-5 shrink-0" aria-hidden="true" /> {ctaLabel}
          </button>
        );
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 pb-48 text-foreground md:px-8 md:pb-36">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Working file</h1>
            <p className="text-sm text-muted break-all">
              ID: {caseData.caseId || "UNASSIGNED"} · User: {sessionUser.email || sessionUser.uid} · One factory · one year
            </p>
          </div>
            <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
            <p
              aria-live="polite"
              aria-busy={saving}
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {saveIndicatorText}
            </p>
            {/* Command chips — file state at a glance, same model as step 8 */}
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Working file state">
              <Step8StateBadge status={step8Status} />
              <span className="rounded-full border border-border bg-neutral-soft px-2.5 py-0.5 font-mono text-[11px] font-bold text-muted">
                {caseData.methodologyDecisions[0]?.rulesetVersion || "EU-CBAM-DEFINITIVE-2026"}
              </span>
            </div>
          </div>
        </header>

        <div
          role="status"
          className="mt-4 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted"
          data-testid="ruleset-pin-banner"
        >
          <p className="font-semibold text-foreground">Ruleset pin for this draft</p>
          <p className="mt-1">
            Sealable calculations will pin{" "}
            <span className="font-mono text-foreground">
              {caseData.methodologyDecisions[0]?.rulesetVersion || "EU-CBAM-DEFINITIVE-2026"}
            </span>
            . A later EU act does not rewrite a sealed package. Same-file re-locks cover ordinary
            corrections — not unlimited free remakes for every methodology change.
          </p>
        </div>

        <WorkingFileJourneyStrip
          currentStep={currentStep}
          completenessPercentage={readiness.completenessPercentage}
          blockerCount={readiness.criticalBlockers.length}
          releasesRemaining={releasesRemaining}
          unlockablePacks={unlockablePacks}
          caseId={caseData.caseId || ""}
        />

        {/* Mobile / tablet step header — no eight-cards row, no horizontal overflow */}
        <section aria-label={`Step ${currentStep} progress summary`} className="mt-4 rounded-xl border border-border bg-surface p-4 lg:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Step {currentStep} of 8</p>
              <h2 className="mt-1 font-serif text-lg font-bold leading-tight break-words">{currentStep === 8 ? STEP8_FINAL_TITLE : wizardStepTitle(currentStep)}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                {currentStep === 8 ? (
                  <Step8StateBadge status={step8Status} />
                ) : (
                  <>
                    {currentStepValidation.completedFieldCount}/{wizardStepTotalFields(currentStep)} fields complete
                    {currentStepValidation.missingEvidenceCount > 0 && (
                      <span className="font-semibold text-status-warning">· {currentStepValidation.missingEvidenceCount} document{currentStepValidation.missingEvidenceCount === 1 ? "" : "s"} needed</span>
                    )}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileStepsOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border bg-neutral-soft px-3 py-2 text-xs font-semibold"
            >
              <Menu className="h-4 w-4" /> View all steps
            </button>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-soft" role="progressbar" aria-valuenow={readiness.completenessPercentage} aria-valuemin={0} aria-valuemax={100} aria-label="Working file completeness">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${readiness.completenessPercentage}%` }} />
          </div>
        </section>

        <div className="mt-6 lg:flex lg:gap-8">
          {/* Desktop step rail — 280px sticky, single navigation */}
          <aside className="hidden w-[280px] shrink-0 lg:block" data-testid="desktop-step-rail">
            <nav className="sticky top-24 space-y-1.5" aria-label="Workflow steps">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Workflow · Step {currentStep} of 8</p>
              {CBAM_WORKFLOW_STEPS.map((step) => stepRailEntry(step.id))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {nextHint && (
              <div role="alert" aria-label="Next step guidance" className="flex flex-col gap-3 rounded-lg border border-status-warning/40 bg-[color:var(--status-warning-soft)] p-4 text-sm text-status-warning md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{nextHint}</span></div>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-status-warning px-3 py-1.5 text-xs font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save and continue later
                </button>
              </div>
            )}

            {showErrors && !currentStepValidation.valid && currentStepValidation.issues.length > 0 && (
              <div role="alert" aria-label="Step validation errors" className="rounded-lg border border-status-blocked/40 bg-[color:var(--status-blocked-soft)] p-4 text-status-blocked">
                <h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> {currentStep === 8 ? "Locking is paused until open requirements are resolved" : "Complete the required fields before continuing"}</h2>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {currentStepValidation.issues.map((issue) => (
                    <li key={`${issue.fieldPath}-${issue.kind}`} className="flex flex-wrap items-start gap-2">
                      <button type="button" onClick={() => focusField(issue.fieldPath)} className="font-semibold underline underline-offset-2">{issue.label}</button>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scenarioActive && (
              <aside className="flex flex-col justify-between gap-4 rounded-xl border-2 border-forest-light bg-forest-pale p-5 text-forest md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em]">Illustrative scenario active</p>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed">
                    Every step is prefilled with a coherent steel-export example. Review the inputs, open the field guidance, and inspect the calculated scenario report in step 8. These values are not evidence and cannot be locked.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartBlankCase}
                  disabled={clearingScenario}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded border border-forest bg-surface-elevated px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {clearingScenario ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}{" "}
                  {clearingScenario ? "Removing…" : "Start with blank working file"}
                </button>
              </aside>
            )}

            <div className="rounded-lg border border-status-warning/30 bg-[color:var(--status-warning-soft)] p-4 text-xs text-status-warning leading-relaxed print:hidden flex gap-3 items-start">
              <Shield className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong>Regulatory Disclaimer:</strong> This platform generates an exporter-prepared verification dossier to streamline independent audit preparation. It is <strong>NOT</strong> an official European Commission verification opinion and does not substitute for independent verification by an EU accredited body.
              </div>
            </div>

            <StatusBanner status={saveStatus} tone={saveTone} />

            <section className="py-2 md:py-4">{stepContent()}</section>
          </div>

          {/* ERP command layer — persistent QC inspector, re-evaluated on every edit */}
          <QcInspectorRail
            gaps={readiness.allGaps}
            completenessPercentage={readiness.completenessPercentage}
            passedControls={readiness.passedControls}
            applicableControls={readiness.applicableControls}
            currentStep={currentStep}
            onGoToStep={handleInspectorGoToStep}
          />
        </div>
      </div>

      {/* Mobile / tablet step drawer */}
      {mobileStepsOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="All workflow steps" data-testid="mobile-step-drawer">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileStepsOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-sm overflow-y-auto border-r border-border bg-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold">All workflow steps</p>
              <button type="button" onClick={() => setMobileStepsOpen(false)} aria-label="Close step list" className="rounded p-1.5 hover:bg-neutral-soft"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-1.5">{CBAM_WORKFLOW_STEPS.map((step) => stepRailEntry(step.id))}</div>
          </div>
        </div>
      )}

      {/* Fixed footer — Previous · manual save · primary seal CTA (never a disabled Next on step 8) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_8px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigateToStep(currentStep - 1)}
              disabled={currentStep === 1}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 sm:flex-none">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} Save progress
              </button>
              {currentStep === 8 && (
                <p className="max-w-[240px] text-[10px] leading-tight text-muted" aria-live="polite">
                  Saves the editable working file. No payment or sealing occurs.
                </p>
              )}
            </div>
            <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:pl-2">{renderFooterCta()}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
