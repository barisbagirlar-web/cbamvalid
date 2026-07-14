"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FileText,
  Loader2,
  Plus,
  Shield,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";
import { performDossierCalculations } from "@/lib/cbam/calculator";
import {
  AuditReadyCase,
  createEmptyInput,
  EvidenceRecord,
  InputDatum,
} from "@/lib/cbam/schema";
import { firebaseStorage } from "@/lib/firebase/client";
import { saveCase, sealReport } from "@/lib/functions/client";

type MethodologyDecision = AuditReadyCase["methodologyDecisions"][number];
type EvidenceSupportStatus = EvidenceRecord["supportStatus"];

interface CaseWizardClientProps {
  sessionUser: { uid: string; email: string };
  initialCase: AuditReadyCase;
  availableEntitlements: Array<{
    entitlementId: string;
    caseId?: string;
    status: string;
    versionSequence?: number;
  }>;
}

const STEPS = [
  { id: 1, label: "Case & Scope" },
  { id: 2, label: "Goods & Allocation" },
  { id: 3, label: "Installation" },
  { id: 4, label: "Emissions" },
  { id: 5, label: "Methods & Precursors" },
  { id: 6, label: "Evidence Review" },
  { id: 7, label: "Quality Review" },
  { id: 8, label: "Seal & Deliver" },
] as const;

const SECTORS = [
  ["IRON_AND_STEEL", "Iron and steel"],
  ["ALUMINIUM", "Aluminium"],
  ["CEMENT", "Cement"],
  ["FERTILISERS", "Fertilisers"],
  ["HYDROGEN", "Hydrogen"],
  ["ELECTRICITY", "Electricity"],
] as const;

const METHODOLOGY_TOPICS = [
  ["PRECURSOR_SCOPE", "Precursor scope / non-applicability"],
  ["GOODS_EMISSIONS_ALLOCATION", "Allocation of installation emissions to goods"],
  ["NON_ASSOCIATED_FLOWS", "Non-associated goods, emissions and energy flows"],
  ["ESTIMATE:directEmissions", "Estimated direct emissions method"],
  ["ESTIMATE:electricityConsumed", "Estimated electricity method"],
  ["ESTIMATE:gridEmissionFactor", "Estimated grid factor method"],
] as const;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain",
]);

function cloneCase(data: AuditReadyCase): AuditReadyCase {
  return structuredClone(data);
}

function normalizeCase(data: AuditReadyCase): AuditReadyCase {
  const next = cloneCase(data);
  next.methodologyDecisions = next.methodologyDecisions || [];
  next.evidenceRegister = next.evidenceRegister || [];
  next.gapAssessment = next.gapAssessment || [];
  next.auditEvents = next.auditEvents || [];
  if (next.goods.length > 1) {
    next.goods = next.goods.map((good) => ({
      ...good,
      allocationShare: good.allocationShare || createEmptyInput("fraction"),
    }));
  }
  return next;
}

function getPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, root);
}

function setInputValue(root: AuditReadyCase, path: string, value: string | null): AuditReadyCase {
  const next = cloneCase(root) as unknown as Record<string, unknown>;
  const parts = path.split(".");
  let current: Record<string, unknown> = next;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (current[part] === undefined) current[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    current = current[part] as Record<string, unknown>;
  }
  const key = parts[parts.length - 1];
  const existing = current[key];
  if (!existing || typeof existing !== "object" || !("value" in existing)) current[key] = createEmptyInput();
  (current[key] as { value: string | null }).value = value;
  return next as unknown as AuditReadyCase;
}

function linkEvidenceToFields(root: AuditReadyCase, paths: string[], evidence: EvidenceRecord): AuditReadyCase {
  const next = cloneCase(root);
  for (const path of paths) {
    const datum = getPath(next, path);
    if (!datum || typeof datum !== "object" || !("value" in datum)) {
      throw new Error(`Selected field is unavailable: ${path}`);
    }
    const input = datum as InputDatum;
    input.evidenceId = evidence.evidenceId;
    input.documentReference = evidence.pageReference || evidence.fileName;
    input.sourceType = "PRIMARY";
    input.confidenceStatus = "HIGH_VERIFIED";
  }
  next.evidenceRegister.push(evidence);
  return next;
}

async function fileSha256(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function safeFileName(name: string): string {
  return (name.split(/[\\/]/).pop() || "evidence.bin")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 160);
}

function createAuditEvent(actor: string, action: string, metadata?: Record<string, unknown>) {
  return {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actor,
    action,
    metadata,
  };
}

export default function CaseWizardClient({
  sessionUser,
  initialCase,
  availableEntitlements,
}: CaseWizardClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [caseData, setCaseData] = useState<AuditReadyCase>(() => normalizeCase(initialCase));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [evidenceForm, setEvidenceForm] = useState<{
    documentType: string;
    issuer: string;
    issueDate: string;
    pageReference: string;
    supportStatus: EvidenceSupportStatus;
    linkedFields: string[];
  }>({
    documentType: "PRODUCTION_OR_MONITORING_RECORD",
    issuer: "",
    issueDate: "",
    pageReference: "",
    supportStatus: "SUPPORTED",
    linkedFields: ["directEmissions"],
  });
  const [methodologyForm, setMethodologyForm] = useState({
    topic: "PRECURSOR_SCOPE",
    selectedMethod: "",
    reason: "",
    legalOrTechnicalBasis: "",
    rejectedAlternativeReason: "",
    evidenceIds: [] as string[],
  });

  const linkableFields = useMemo(() => {
    const fields = [
      { value: "importerIdentity.eoriNumber", label: "Declarant EORI" },
      { value: "installation.name", label: "Installation name" },
      { value: "installation.country", label: "Installation country" },
      { value: "installation.productionRoute", label: "Production route" },
      { value: "directEmissions", label: "Direct emissions" },
      { value: "electricityConsumed", label: "Electricity consumed" },
      { value: "gridEmissionFactor", label: "Grid emission factor" },
    ];
    caseData.goods.forEach((_, index) => {
      fields.push(
        { value: `goods.${index}.cnCode`, label: `Good ${index + 1} — CN code` },
        { value: `goods.${index}.productionVolume`, label: `Good ${index + 1} — production volume` }
      );
      if (caseData.goods.length > 1) fields.push({ value: `goods.${index}.allocationShare`, label: `Good ${index + 1} — allocation share` });
    });
    caseData.precursors.forEach((_, index) => {
      fields.push(
        { value: `precursors.${index}.quantity`, label: `Precursor ${index + 1} — quantity` },
        { value: `precursors.${index}.directEmissions`, label: `Precursor ${index + 1} — direct emissions` },
        { value: `precursors.${index}.indirectEmissions`, label: `Precursor ${index + 1} — indirect emissions` }
      );
    });
    return fields;
  }, [caseData.goods, caseData.precursors]);

  const readiness = useMemo(() => assessCaseReadiness(caseData), [caseData]);
  const calculationPreview = useMemo(() => {
    try {
      return { result: performDossierCalculations(caseData), error: "" };
    } catch (calculationError) {
      return {
        result: null,
        error: calculationError instanceof Error ? calculationError.message : "CALCULATION_FAILED",
      };
    }
  }, [caseData]);

  const caseEntitlements = useMemo(
    () => availableEntitlements
      .filter((item) => item.status === "AVAILABLE" && item.caseId === caseData.caseId)
      .sort((a, b) => Number(a.versionSequence || 0) - Number(b.versionSequence || 0)),
    [availableEntitlements, caseData.caseId]
  );

  const allocationTotal = useMemo(() => {
    if (caseData.goods.length <= 1) return "1";
    const values = caseData.goods.map((good) => Number(good.allocationShare?.value));
    if (values.some((value) => !Number.isFinite(value))) return "Not complete";
    return values.reduce((sum, value) => sum + value, 0).toFixed(6);
  }, [caseData.goods]);

  const updateValue = (path: string, value: string) => {
    setCaseData((previous) => setInputValue(previous, path, value === "" ? null : value));
    setMessage("");
    setError("");
  };

  const saveDraft = async (data = caseData, successMessage = "Draft saved.") => {
    if (!data.caseId) throw new Error("CASE_ID_MISSING");
    setSaving(true);
    setError("");
    try {
      await saveCase(data, data.caseId);
      setMessage(successMessage);
    } catch (saveError: unknown) {
      console.error("Draft save failed", saveError);
      const messageText = saveError instanceof Error ? saveError.message : "The draft could not be saved.";
      setError(messageText);
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  const addGood = () => {
    setCaseData((previous) => {
      const next = cloneCase(previous);
      next.goods = next.goods.map((good) => ({ ...good, allocationShare: good.allocationShare || createEmptyInput("fraction") }));
      next.goods.push({
        cnCode: createEmptyInput(),
        sector: "IRON_AND_STEEL",
        productionVolume: createEmptyInput("t"),
        shipmentRecords: createEmptyInput("t"),
        allocationShare: createEmptyInput("fraction"),
      });
      return next;
    });
  };

  const removeGood = (index: number) => {
    setCaseData((previous) => {
      const next = cloneCase(previous);
      next.goods.splice(index, 1);
      if (next.goods.length === 1) next.goods[0] = { ...next.goods[0], allocationShare: undefined };
      return next;
    });
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

  const removePrecursor = (index: number) => {
    setCaseData((previous) => ({
      ...previous,
      precursors: previous.precursors.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const uploadEvidence = async (file: File | null) => {
    if (!file || !caseData.caseId) return;
    setError("");
    setMessage("");
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError("Unsupported evidence file type. Use PDF, CSV, XLS/XLSX, PNG, JPEG or TXT.");
      return;
    }
    if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
      setError("Evidence files must be larger than 0 bytes and no larger than 20 MB.");
      return;
    }
    if (!evidenceForm.issuer.trim() || !evidenceForm.issueDate || evidenceForm.linkedFields.length === 0) {
      setError("Issuer, document date and at least one supported dossier field are required.");
      return;
    }

    setUploading(true);
    try {
      const evidenceId = crypto.randomUUID();
      const fileName = safeFileName(file.name);
      const storagePath = `evidence/${sessionUser.uid}/${caseData.caseId}/${evidenceId}/${fileName}`;
      const fileHash = await fileSha256(file);
      if (caseData.evidenceRegister.some((record) => record.fileHash === fileHash)) {
        throw new Error("The same evidence file is already registered in this dossier.");
      }

      await uploadBytes(ref(firebaseStorage, storagePath), file, {
        contentType: file.type,
        customMetadata: { evidenceId, caseId: caseData.caseId, sha256: fileHash },
      });

      const evidence: EvidenceRecord = {
        evidenceId,
        documentType: evidenceForm.documentType.trim(),
        fileName,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        issuer: evidenceForm.issuer.trim(),
        issueDate: evidenceForm.issueDate,
        reportingPeriod: String(caseData.reportingPeriod.year.value || ""),
        pageReference: evidenceForm.pageReference.trim() || undefined,
        fileHash,
        uploadTimestamp: new Date().toISOString(),
        uploader: sessionUser.uid,
        reviewStatus: "PENDING",
        supportStatus: evidenceForm.supportStatus,
        confidentiality: "CONFIDENTIAL",
        linkedInputs: evidenceForm.linkedFields,
        linkedCalculations: [],
      };

      const next = linkEvidenceToFields(caseData, evidenceForm.linkedFields, evidence);
      next.auditEvents.push(createAuditEvent(sessionUser.uid, "EVIDENCE_UPLOADED_AND_LINKED", {
        evidenceId,
        fileHash,
        linkedInputs: evidenceForm.linkedFields,
      }));
      setCaseData(next);
      await saveDraft(next, "Evidence uploaded, hashed and linked. Complete the internal evidence review before sealing.");
      setEvidenceForm((previous) => ({ ...previous, issuer: "", issueDate: "", pageReference: "" }));
    } catch (uploadError: unknown) {
      console.error("Evidence upload failed", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Evidence could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const approveEvidence = async (evidenceId: string) => {
    const note = (reviewNotes[evidenceId] || "").trim();
    if (note.length < 5) {
      setError("Enter a substantive internal review note before approving this evidence record.");
      return;
    }
    const next = cloneCase(caseData);
    const evidence = next.evidenceRegister.find((item) => item.evidenceId === evidenceId);
    if (!evidence) return;
    evidence.reviewStatus = "APPROVED";
    evidence.reviewerNotes = note;
    next.auditEvents.push(createAuditEvent(sessionUser.uid, "EVIDENCE_INTERNALLY_APPROVED", {
      evidenceId,
      reviewerNote: note,
      boundary: "INTERNAL_DATA_OWNER_REVIEW_NOT_EXTERNAL_VERIFICATION",
    }));
    setCaseData(next);
    await saveDraft(next, "Evidence record internally reviewed and approved for dossier preparation.");
  };

  const removeEvidence = async (evidence: EvidenceRecord) => {
    setError("");
    try {
      await deleteObject(ref(firebaseStorage, evidence.storagePath));
      const next = cloneCase(caseData);
      next.evidenceRegister = next.evidenceRegister.filter((item) => item.evidenceId !== evidence.evidenceId);
      for (const path of evidence.linkedInputs) {
        const datum = getPath(next, path);
        if (datum && typeof datum === "object" && "evidenceId" in datum && (datum as { evidenceId?: string }).evidenceId === evidence.evidenceId) {
          const input = datum as { evidenceId?: string; documentReference?: string; confidenceStatus: string; sourceType: string };
          input.evidenceId = undefined;
          input.documentReference = undefined;
          input.confidenceStatus = "LOW_ESTIMATE";
          input.sourceType = "ESTIMATED";
        }
      }
      next.methodologyDecisions = next.methodologyDecisions.map((decision) => ({
        ...decision,
        evidenceIds: decision.evidenceIds.filter((id) => id !== evidence.evidenceId),
      }));
      next.auditEvents.push(createAuditEvent(sessionUser.uid, "EVIDENCE_REMOVED", { evidenceId: evidence.evidenceId }));
      setCaseData(next);
      await saveDraft(next, "Evidence removed. Linked fields returned to unsupported status.");
    } catch (removeError: unknown) {
      setError(removeError instanceof Error ? removeError.message : "Evidence could not be removed.");
    }
  };

  const saveMethodologyDecision = async () => {
    const form = methodologyForm;
    if (!form.selectedMethod.trim() || !form.reason.trim() || !form.legalOrTechnicalBasis.trim()) {
      setError("Selected method, rationale and legal or technical basis are required.");
      return;
    }
    if (form.topic === "GOODS_EMISSIONS_ALLOCATION" && form.evidenceIds.length === 0) {
      setError("The allocation methodology decision must reference at least one evidence record.");
      return;
    }
    const next = cloneCase(caseData);
    const decision: MethodologyDecision = {
      decisionId: crypto.randomUUID(),
      topic: form.topic,
      selectedMethod: form.selectedMethod.trim(),
      reason: form.reason.trim(),
      legalOrTechnicalBasis: form.legalOrTechnicalBasis.trim(),
      evidenceIds: form.evidenceIds,
      rejectedAlternativeReason: form.rejectedAlternativeReason.trim() || undefined,
      reviewStatus: "ACCEPTED",
      rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
    };
    const existingIndex = next.methodologyDecisions.findIndex((item) => item.topic === form.topic);
    if (existingIndex >= 0) next.methodologyDecisions[existingIndex] = decision;
    else next.methodologyDecisions.push(decision);
    next.auditEvents.push(createAuditEvent(sessionUser.uid, "METHODOLOGY_DECISION_ACCEPTED", {
      topic: form.topic,
      decisionId: decision.decisionId,
      boundary: "INTERNAL_OPERATOR_DECISION_NOT_EXTERNAL_VERIFIER_CONCLUSION",
    }));
    setCaseData(next);
    await saveDraft(next, "Methodology decision recorded and internally accepted.");
    setMethodologyForm((previous) => ({
      ...previous,
      selectedMethod: "",
      reason: "",
      legalOrTechnicalBasis: "",
      rejectedAlternativeReason: "",
      evidenceIds: [],
    }));
  };

  const removeMethodologyDecision = async (topic: string) => {
    const next = cloneCase(caseData);
    next.methodologyDecisions = next.methodologyDecisions.filter((item) => item.topic !== topic);
    next.auditEvents.push(createAuditEvent(sessionUser.uid, "METHODOLOGY_DECISION_REMOVED", { topic }));
    setCaseData(next);
    await saveDraft(next, "Methodology decision removed.");
  };

  const handleSeal = async () => {
    if (!caseData.caseId) return;
    if (!readiness.isEligibleForSealing) {
      setError("Resolve every blocker and warning before generating a release.");
      return;
    }
    const entitlement = caseEntitlements[0];
    if (!entitlement) {
      setError("No available Preparation Pack version is linked to this dossier.");
      return;
    }
    setSealing(true);
    setError("");
    setMessage("");
    try {
      await saveDraft(caseData, "Dossier saved. Generating sealed package…");
      const response = await sealReport(caseData.caseId, entitlement.entitlementId, crypto.randomUUID());
      const reportId = response?.report?.reportId;
      if (!reportId) throw new Error("Release ID was not returned.");
      router.push(`/cbam/reports/${reportId}`);
    } catch (sealError: unknown) {
      console.error("Sealing failed", sealError);
      setError(sealError instanceof Error ? sealError.message : "The release could not be generated. No report version was consumed.");
    } finally {
      setSealing(false);
    }
  };

  const renderStep1 = () => (
    <Section title="1. Case & Reporting Scope" description="Identify the operator/exporter, EU importer or declarant, reporting period and legal dossier boundary.">
      <Field label="Exporter or operator legal name" value={caseData.exporterIdentity.legalName.value} onChange={(value) => updateValue("exporterIdentity.legalName", value)} required />
      <Field label="Importer or declarant legal name" value={caseData.importerIdentity.legalName.value} onChange={(value) => updateValue("importerIdentity.legalName", value)} required />
      <Field label="Declarant EORI number" value={caseData.importerIdentity.eoriNumber.value} onChange={(value) => updateValue("importerIdentity.eoriNumber", value.toUpperCase())} required hint="Two-letter country prefix followed by 6–15 alphanumeric characters." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reporting year" type="number" value={caseData.reportingPeriod.year.value} onChange={(value) => updateValue("reportingPeriod.year", value)} required />
        <Field label="Reporting quarter or period" value={caseData.reportingPeriod.quarter.value} onChange={(value) => updateValue("reportingPeriod.quarter", value)} required hint="Examples: Annual, Q1, January–March." />
      </div>
      <BoundaryNotice />
    </Section>
  );

  const renderStep2 = () => (
    <Section title="2. Goods, Customs Classification & Allocation" description="Add every covered CN group and define an evidence-supported emissions allocation when the installation produces multiple goods.">
      <div className="space-y-4">
        {caseData.goods.map((good, index) => (
          <div key={index} className="space-y-4 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Good {index + 1}</h3>
              <button type="button" onClick={() => removeGood(index)} className="text-xs font-semibold text-red-700 hover:underline">Remove</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="8-digit CN code" value={good.cnCode.value} onChange={(value) => updateValue(`goods.${index}.cnCode`, value.replace(/\D/g, "").slice(0, 8))} required />
              <SelectField label="Sector" value={good.sector} options={SECTORS} onChange={(value) => setCaseData((previous) => { const next = cloneCase(previous); next.goods[index].sector = value; return next; })} />
              <Field label="Production volume" type="number" value={good.productionVolume.value} onChange={(value) => updateValue(`goods.${index}.productionVolume`, value)} required hint="Canonical reporting unit: tonnes." />
              <Field label="Shipment quantity or record total" type="number" value={good.shipmentRecords.value} onChange={(value) => updateValue(`goods.${index}.shipmentRecords`, value)} hint="Context record; does not replace production evidence." />
              {caseData.goods.length > 1 && (
                <Field label="Emissions allocation share" type="number" value={good.allocationShare?.value} onChange={(value) => updateValue(`goods.${index}.allocationShare`, value)} required hint="Decimal fraction from 0 to 1. All shares must total exactly 1.000000." />
              )}
            </div>
          </div>
        ))}
        <button type="button" onClick={addGood} className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-neutral-soft">
          <Plus className="h-4 w-4" /> Add Good
        </button>
      </div>
      {caseData.goods.length > 1 && (
        <div className={`rounded-xl border p-4 ${allocationTotal === "1.000000" ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"}`}>
          <p className="font-bold">Allocation reconciliation</p>
          <p className="mt-1 text-sm">Current allocation total: {allocationTotal}. Required total: 1.000000.</p>
          <p className="mt-1 text-xs text-muted">Each share must be linked to approved evidence and supported by an accepted allocation methodology decision.</p>
        </div>
      )}
    </Section>
  );

  const renderStep3 = () => (
    <Section title="3. Installation & Production Boundary" description="Define the installation, physical production route and included or excluded processes so an external verifier can challenge the boundary.">
      <Field label="Installation name" value={caseData.installation.name.value} onChange={(value) => updateValue("installation.name", value)} required />
      <Field label="Installation country" value={caseData.installation.country.value} onChange={(value) => updateValue("installation.country", value)} required hint="Use an ISO country code or unambiguous English country name." />
      <Field label="Production route" value={caseData.installation.productionRoute.value} onChange={(value) => updateValue("installation.productionRoute", value)} required />
      <label className="block text-sm font-semibold text-foreground">
        System-boundary statement <span className="text-red-700">*</span>
        <textarea value={caseData.installation.systemBoundaries || ""} onChange={(event) => setCaseData((previous) => ({ ...previous, installation: { ...previous.installation, systemBoundaries: event.target.value } }))} rows={7} className="mt-1 w-full rounded-md border border-border bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" placeholder="Describe included processes, source streams, transfers, excluded flows, shared utilities and allocation boundary." />
      </label>
      <div className="rounded-xl border border-border bg-neutral-soft p-4 text-sm text-muted">
        A strong boundary statement identifies included and excluded process units, shared energy, waste gases, precursor transfers, non-associated goods and the allocation basis.
      </div>
    </Section>
  );

  const renderStep4 = () => (
    <Section title="4. Embedded Emissions Inputs & Results" description="Enter canonical activity data. The browser preview is diagnostic; the sealed release is recalculated by the server engine.">
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Direct emissions (tCO2e)" type="number" value={caseData.directEmissions.value} onChange={(value) => updateValue("directEmissions", value)} required />
        <Field label="Electricity consumed (MWh)" type="number" value={caseData.electricityConsumed.value} onChange={(value) => updateValue("electricityConsumed", value)} required />
        <Field label="Grid factor (tCO2e/MWh)" type="number" value={caseData.gridEmissionFactor.value} onChange={(value) => updateValue("gridEmissionFactor", value)} required />
      </div>
      {calculationPreview.result ? (
        <div className="space-y-4 rounded-xl border border-green-300 bg-green-50 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Total direct" value={`${calculationPreview.result.totalDirectEmissions} tCO2e`} />
            <Metric label="Total indirect" value={`${calculationPreview.result.totalIndirectEmissions} tCO2e`} />
            <Metric label="Total embedded" value={`${calculationPreview.result.totalEmbeddedEmissions} tCO2e`} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead><tr className="border-b border-green-300"><th className="p-2">Good</th><th className="p-2">CN</th><th className="p-2">Share</th><th className="p-2">Production</th><th className="p-2">Allocated emissions</th><th className="p-2">Specific emissions</th></tr></thead>
              <tbody>{calculationPreview.result.goods.map((good) => <tr key={good.goodIndex} className="border-b border-green-200"><td className="p-2">{good.goodIndex}</td><td className="p-2 font-mono">{good.cnCode || "Pending"}</td><td className="p-2">{good.allocationShare}</td><td className="p-2">{good.productionVolume} t</td><td className="p-2">{good.allocatedEmbeddedEmissions} tCO2e</td><td className="p-2 font-semibold">{good.specificEmbeddedEmissions} tCO2e/t</td></tr>)}</tbody>
            </table>
          </div>
          <p className="text-xs text-green-900">Allocation total {calculationPreview.result.allocationShareTotal}; reconciliation delta {calculationPreview.result.allocationReconciliationDelta}.</p>
        </div>
      ) : (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Calculation preview is blocked: {calculationPreview.error}
        </div>
      )}
    </Section>
  );

  const renderStep5 = () => (
    <Section title="5. Precursors, Adjustments & Methodology Decisions" description="Document precursor data and every material method or non-applicability judgement that an external verifier must challenge.">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Precursors</h3><button type="button" onClick={addPrecursor} className="inline-flex items-center gap-1 text-sm font-semibold text-accent"><Plus className="h-4 w-4" /> Add precursor</button></div>
        {caseData.precursors.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">No precursor records declared. Add an accepted PRECURSOR_SCOPE decision explaining why this is appropriate.</p>}
        {caseData.precursors.map((precursor, index) => (
          <div key={index} className="space-y-4 rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between"><h4 className="font-bold">Precursor {index + 1}</h4><button type="button" onClick={() => removePrecursor(index)} className="text-xs font-semibold text-red-700">Remove</button></div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Precursor name" value={precursor.name.value} onChange={(value) => updateValue(`precursors.${index}.name`, value)} required />
              <Field label="Country of origin" value={precursor.countryOfOrigin.value} onChange={(value) => updateValue(`precursors.${index}.countryOfOrigin`, value)} required />
              <Field label="Quantity (t)" type="number" value={precursor.quantity.value} onChange={(value) => updateValue(`precursors.${index}.quantity`, value)} required />
              <Field label="Direct emissions (tCO2e)" type="number" value={precursor.directEmissions.value} onChange={(value) => updateValue(`precursors.${index}.directEmissions`, value)} required />
              <Field label="Indirect emissions (tCO2e)" type="number" value={precursor.indirectEmissions.value} onChange={(value) => updateValue(`precursors.${index}.indirectEmissions`, value)} required />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-5 border-t border-border pt-6">
        <h3 className="font-bold">Methodology decision register</h3>
        <SelectField label="Decision topic" value={methodologyForm.topic} options={METHODOLOGY_TOPICS} onChange={(value) => setMethodologyForm((previous) => ({ ...previous, topic: value }))} />
        <Field label="Selected method or conclusion" value={methodologyForm.selectedMethod} onChange={(value) => setMethodologyForm((previous) => ({ ...previous, selectedMethod: value }))} required />
        <TextAreaField label="Rationale" value={methodologyForm.reason} onChange={(value) => setMethodologyForm((previous) => ({ ...previous, reason: value }))} placeholder="Explain why the method is appropriate for this installation, reporting period and goods." required />
        <TextAreaField label="Legal or technical basis" value={methodologyForm.legalOrTechnicalBasis} onChange={(value) => setMethodologyForm((previous) => ({ ...previous, legalOrTechnicalBasis: value }))} placeholder="Cite the applicable rule, monitoring plan, engineering basis or source method." required />
        <TextAreaField label="Rejected alternative and reason" value={methodologyForm.rejectedAlternativeReason} onChange={(value) => setMethodologyForm((previous) => ({ ...previous, rejectedAlternativeReason: value }))} placeholder="Record the principal alternative and why it was not selected." />
        <CheckboxGrid title="Evidence supporting this decision" options={caseData.evidenceRegister.map((evidence) => ({ value: evidence.evidenceId, label: `${evidence.fileName} · ${evidence.reviewStatus}` }))} selected={methodologyForm.evidenceIds} onChange={(evidenceIds) => setMethodologyForm((previous) => ({ ...previous, evidenceIds }))} emptyText="Upload evidence before linking it to a methodology decision." />
        <button type="button" onClick={saveMethodologyDecision} className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-surface hover:bg-accent-hover"><FileCheck2 className="h-4 w-4" /> Record & Internally Accept Decision</button>
        <p className="text-xs text-muted">Internal acceptance records the operator’s controlled methodology decision. It is not an external verifier conclusion.</p>

        <div className="space-y-3">
          {caseData.methodologyDecisions.map((decision) => (
            <div key={decision.topic} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-4"><div><p className="font-bold">{decision.topic}</p><p className="mt-1 text-sm text-muted">{decision.selectedMethod}</p></div><button type="button" onClick={() => removeMethodologyDecision(decision.topic)} className="text-xs font-semibold text-red-700">Remove</button></div>
              <p className="mt-3 text-sm"><strong>Rationale:</strong> {decision.reason}</p>
              <p className="mt-2 text-sm"><strong>Basis:</strong> {decision.legalOrTechnicalBasis}</p>
              <p className="mt-2 text-xs text-muted">Status {decision.reviewStatus} · Evidence {decision.evidenceIds.length} · Ruleset {decision.rulesetVersion}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );

  const renderStep6 = () => (
    <Section title="6. Evidence Register & Internal Review" description="Upload source documents, hash them, link them to every material field and complete an explicit internal data-owner review.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Document type" value={evidenceForm.documentType} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, documentType: value }))} required />
        <Field label="Issuer" value={evidenceForm.issuer} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, issuer: value }))} required />
        <Field label="Document date" type="date" value={evidenceForm.issueDate} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, issueDate: value }))} required />
        <Field label="Page, sheet or record reference" value={evidenceForm.pageReference} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, pageReference: value }))} />
        <SelectField label="Support assessment" value={evidenceForm.supportStatus} options={[["SUPPORTED", "Supported"], ["PARTIALLY_SUPPORTED", "Partially supported"]] as const} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, supportStatus: value as EvidenceSupportStatus }))} />
      </div>
      <CheckboxGrid title="Material fields supported by this document" options={linkableFields} selected={evidenceForm.linkedFields} onChange={(linkedFields) => setEvidenceForm((previous) => ({ ...previous, linkedFields }))} emptyText="Add dossier fields before uploading evidence." />
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background p-5 text-center hover:bg-neutral-soft">
        {uploading ? <Loader2 className="mb-2 h-6 w-6 animate-spin text-accent" /> : <UploadCloud className="mb-2 h-6 w-6 text-accent" />}
        <span className="text-sm font-semibold">{uploading ? "Uploading and hashing…" : "Choose evidence file"}</span>
        <span className="mt-1 text-xs text-muted">PDF, CSV, XLS/XLSX, PNG, JPEG or TXT · maximum 20 MB</span>
        <input type="file" className="sr-only" disabled={uploading} accept=".pdf,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={(event) => uploadEvidence(event.target.files?.[0] || null)} />
      </label>

      <div className="space-y-4">
        {caseData.evidenceRegister.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">No evidence uploaded. Sealing remains blocked.</p>}
        {caseData.evidenceRegister.map((evidence) => (
          <div key={evidence.evidenceId} className="rounded-xl border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><p className="truncate text-sm font-bold">{evidence.fileName}</p><p className="mt-1 text-xs text-muted">{evidence.documentType} · {evidence.issuer} · {evidence.issueDate}</p><p className="mt-1 text-xs text-muted">Linked fields: {evidence.linkedInputs.join(", ")}</p><p className="mt-1 truncate font-mono text-[10px] text-muted" title={evidence.fileHash}>SHA-256: {evidence.fileHash}</p></div>
              <div className="flex gap-2"><StatusBadge value={evidence.reviewStatus} /><StatusBadge value={evidence.supportStatus} /></div>
            </div>
            {evidence.reviewStatus !== "APPROVED" ? (
              <div className="mt-4 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                <TextAreaField label="Internal review note" value={reviewNotes[evidence.evidenceId] || ""} onChange={(value) => setReviewNotes((previous) => ({ ...previous, [evidence.evidenceId]: value }))} placeholder="Confirm issuer, reporting period, field linkage, legibility, completeness and support status." required />
                <button type="button" onClick={() => approveEvidence(evidence.evidenceId)} className="inline-flex h-10 items-center gap-2 rounded-md bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800"><CheckCircle2 className="h-4 w-4" /> Approve for Internal Dossier Use</button>
              </div>
            ) : (
              <p className="mt-3 rounded-lg border border-green-300 bg-green-50 p-3 text-xs text-green-900">Internal review completed: {evidence.reviewerNotes}</p>
            )}
            <button type="button" onClick={() => removeEvidence(evidence)} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-red-700"><Trash2 className="h-4 w-4" /> Remove evidence</button>
          </div>
        ))}
      </div>
      <BoundaryNotice text="Internal evidence approval confirms dossier preparation controls only. The accredited verifier remains responsible for independent verification procedures and conclusions." />
    </Section>
  );

  const renderStep7 = () => (
    <Section title="7. Verification Readiness & Remediation" description="The dossier cannot be sealed until every material identity, evidence, method, unit, calculation and finding control is closed.">
      <div className={`rounded-xl border p-5 ${readiness.isEligibleForSealing ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
        <div className="flex items-center gap-3">{readiness.isEligibleForSealing ? <CheckCircle2 className="h-6 w-6 text-green-700" /> : <CircleAlert className="h-6 w-6 text-red-700" />}<div><p className="font-bold">{readiness.status.replace(/_/g, " ")}</p><p className="text-sm">Completeness {readiness.completenessPercentage}% · Evidence coverage {readiness.evidenceCoveragePercentage}%</p></div></div>
      </div>
      <div className="space-y-3">
        {readiness.allGaps.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 p-4 text-sm font-semibold text-green-800"><CheckCircle2 className="h-5 w-5" /> No open readiness findings.</div>
        ) : readiness.allGaps.map((gap) => (
          <div key={gap.gapId} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3"><p className="font-bold">{gap.requirement}</p><StatusBadge value={gap.severity} /></div>
            <p className="mt-2 text-sm text-muted">{gap.whyItMatters}</p>
            <p className="mt-2 text-sm"><strong>Required action:</strong> {gap.suggestedAction}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-neutral-soft p-4"><p className="font-bold">Calculation integrity preview</p><p className="mt-1 text-sm text-muted">{calculationPreview.result?.trace.length || 0} trace nodes · {calculationPreview.result?.goods.length || 0} per-good results · allocation delta {calculationPreview.result?.allocationReconciliationDelta || "NOT_CALCULATED"}</p></div>
    </Section>
  );

  const renderStep8 = () => (
    <Section title="8. Seal & Generate Verifier-Preparation Package" description="Generate one immutable release containing premium PDF reports, structured registers, calculation trace, evidence and a cryptographic integrity manifest.">
      <div className="grid gap-5 md:grid-cols-3">
        <ValueCard icon={<Shield className="h-6 w-6 text-accent" />} title="Fail-closed quality" text={`Readiness: ${readiness.status.replace(/_/g, " ")}`} />
        <ValueCard icon={<FileText className="h-6 w-6 text-accent" />} title="23-component dossier" text="Operator report, summary, calculation annex, registers, evidence and manifest." />
        <ValueCard icon={<FileCheck2 className="h-6 w-6 text-accent" />} title="External verifier handoff" text="Structured for professional scepticism, reperformance and completion by an accredited verifier." />
      </div>
      {!caseEntitlements.length ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-bold text-amber-900">No active Preparation Pack version is linked to this dossier.</p>
          <p className="mt-2 text-sm text-amber-800">Complete the full dossier and quality review before acquiring a pack for sealing.</p>
          <Link href="/credits/buy" className="mt-4 inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-surface">Open Preparation Pack</Link>
        </div>
      ) : (
        <button type="button" onClick={handleSeal} disabled={!readiness.isEligibleForSealing || sealing} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-6 font-semibold text-surface hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
          {sealing ? <><Loader2 className="h-5 w-5 animate-spin" /> Generating immutable package…</> : "Seal One Version & Generate Premium Package"}
        </button>
      )}
      <BoundaryNotice text="A failed or blocked generation consumes no version. The package prepares evidence and calculations for independent verification; it does not contain an accredited verifier’s assurance conclusion." />
    </Section>
  );

  const renderers = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8];
  const content = renderers[currentStep - 1]();

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">CBAMValid Verifier-Grade Dossier</p><h1 className="mt-2 text-2xl font-bold font-serif">Exporter Verification Preparation Dossier</h1><p className="mt-1 text-xs font-mono text-muted">Case ID: {caseData.caseId}</p></div>
          <button type="button" onClick={() => saveDraft()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-5 text-sm font-semibold hover:bg-neutral-soft disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? "Saving…" : "Save Draft"}</button>
        </div>

        {(message || error) && <div role={error ? "alert" : "status"} className={`rounded-lg border p-4 text-sm ${error ? "border-red-300 bg-red-50 text-red-800" : "border-green-300 bg-green-50 text-green-800"}`}>{error || message}</div>}

        <div className="grid grid-cols-4 gap-2 overflow-x-auto md:grid-cols-8">
          {STEPS.map((step) => <button key={step.id} type="button" onClick={() => setCurrentStep(step.id)} className={`min-w-24 rounded-lg border p-3 text-center transition-colors ${currentStep === step.id ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:text-foreground"}`}><span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs font-bold">{step.id}</span><span className="mt-2 block text-[10px] font-bold uppercase leading-tight">{step.label}</span></button>)}
        </div>

        {content}

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <button type="button" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={currentStep === 1} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Previous</button>
            <span className="text-xs font-bold text-muted">Step {currentStep} of 8</span>
            <button type="button" onClick={() => setCurrentStep((step) => Math.min(8, step + 1))} disabled={currentStep === 8} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-surface disabled:opacity-40">Next <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="mx-auto max-w-5xl space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-8"><div><h2 className="text-xl font-bold font-serif">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted">{description}</p></div><div className="space-y-5">{children}</div></section>;
}

function Field({ label, value, onChange, type = "text", required = false, hint }: { label: string; value: unknown; onChange: (value: string) => void; type?: string; required?: boolean; hint?: string }) {
  return <label className="block text-sm font-semibold text-foreground">{label} {required && <span className="text-red-700">*</span>}<input type={type} value={value === null || value === undefined ? "" : String(value)} onChange={(event) => onChange(event.target.value)} step={type === "number" ? "any" : undefined} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />{hint && <span className="mt-1 block text-xs font-normal text-muted">{hint}</span>}</label>;
}

function TextAreaField({ label, value, onChange, placeholder, required = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <label className="block text-sm font-semibold text-foreground">{label} {required && <span className="text-red-700">*</span>}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={4} className="mt-1 w-full rounded-md border border-border bg-background p-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-foreground">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function CheckboxGrid({ title, options, selected, onChange, emptyText }: { title: string; options: Array<{ value: string; label: string }>; selected: string[]; onChange: (values: string[]) => void; emptyText: string }) {
  return <fieldset className="rounded-xl border border-border bg-background p-4"><legend className="px-1 text-sm font-bold">{title}</legend>{options.length === 0 ? <p className="text-sm text-muted">{emptyText}</p> : <div className="grid max-h-64 gap-2 overflow-y-auto md:grid-cols-2">{options.map((option) => <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-sm hover:bg-neutral-soft"><input type="checkbox" className="mt-0.5" checked={selected.includes(option.value)} onChange={(event) => onChange(event.target.checked ? [...selected, option.value] : selected.filter((value) => value !== option.value))} /><span>{option.label}</span></label>)}</div>}</fieldset>;
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const style = normalized.includes("APPROVED") || normalized.includes("PASS") || normalized.includes("SUPPORTED") || normalized.includes("READY") ? "border-green-300 bg-green-50 text-green-800" : normalized.includes("PENDING") || normalized.includes("WARNING") || normalized.includes("MINOR") ? "border-amber-300 bg-amber-50 text-amber-800" : "border-red-300 bg-red-50 text-red-800";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${style}`}>{value.replace(/_/g, " ")}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-green-200 bg-white p-3"><p className="text-xs text-muted">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-border bg-background p-5">{icon}<h3 className="mt-3 font-bold">{title}</h3><p className="mt-2 text-sm text-muted">{text}</p></div>;
}

function BoundaryNotice({ text = "CBAMValid prepares the operator/exporter dossier for independent verification. It does not issue an accredited verification opinion, customs decision, EU approval or Registry acceptance guarantee." }: { text?: string }) {
  return <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950"><strong>Verification boundary:</strong> {text}</div>;
}
