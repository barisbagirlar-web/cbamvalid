"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCode2,
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
} from "@/lib/cbam/schema";
import { firebaseStorage } from "@/lib/firebase/client";
import { saveCase, sealReport } from "@/lib/functions/client";

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
  { id: 2, label: "Goods & Customs" },
  { id: 3, label: "Installation" },
  { id: 4, label: "Emissions" },
  { id: 5, label: "Precursors & Adjustments" },
  { id: 6, label: "Evidence Register" },
  { id: 7, label: "Quality Review" },
  { id: 8, label: "Seal & Deliverables" },
] as const;

const LINKABLE_FIELDS = [
  { value: "directEmissions", label: "Direct emissions" },
  { value: "electricityConsumed", label: "Electricity consumed" },
  { value: "gridEmissionFactor", label: "Grid emission factor" },
  { value: "goods.0.productionVolume", label: "First good production volume" },
  { value: "goods.0.cnCode", label: "First good CN code" },
  { value: "importerIdentity.eoriNumber", label: "Declarant EORI" },
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

function getPath(root: any, path: string): any {
  return path.split(".").reduce((current, part) => current?.[part], root);
}

function setInputValue(root: AuditReadyCase, path: string, value: string | null): AuditReadyCase {
  const next = cloneCase(root) as any;
  const parts = path.split(".");
  let current = next;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (current[part] === undefined) {
      current[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    }
    current = current[part];
  }
  const key = parts[parts.length - 1];
  if (!current[key] || typeof current[key] !== "object" || !("value" in current[key])) {
    current[key] = createEmptyInput();
  }
  current[key].value = value;
  return next;
}

function linkEvidence(root: AuditReadyCase, path: string, evidence: EvidenceRecord): AuditReadyCase {
  const next = cloneCase(root) as any;
  const datum = getPath(next, path);
  if (!datum || typeof datum !== "object" || !("value" in datum)) {
    throw new Error("Selected field is unavailable in the dossier.");
  }
  datum.evidenceId = evidence.evidenceId;
  datum.documentReference = evidence.pageReference || evidence.fileName;
  datum.sourceType = "PRIMARY";
  datum.confidenceStatus = "HIGH_VERIFIED";
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

export default function CaseWizardClient({
  sessionUser,
  initialCase,
  availableEntitlements,
}: CaseWizardClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [caseData, setCaseData] = useState<AuditReadyCase>(() => ({
    ...initialCase,
    methodologyDecisions: initialCase.methodologyDecisions || [],
  }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [evidenceForm, setEvidenceForm] = useState({
    documentType: "UTILITY_INVOICE",
    issuer: "",
    issueDate: "",
    pageReference: "",
    linkedField: "directEmissions",
  });

  const readiness = useMemo(() => assessCaseReadiness(caseData), [caseData]);
  const calculationPreview = useMemo(() => {
    try {
      return performDossierCalculations(caseData);
    } catch (calculationError) {
      return {
        trace: [],
        totalEmbeddedEmissions: "NOT_CALCULATED",
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

  const updateValue = (path: string, value: string) => {
    setCaseData((previous) => setInputValue(previous, path, value === "" ? null : value));
    setMessage("");
  };

  const saveDraft = async (data = caseData) => {
    if (!data.caseId) throw new Error("CASE_ID_MISSING");
    setSaving(true);
    setError("");
    try {
      await saveCase(data, data.caseId);
      setMessage("Draft saved.");
    } catch (saveError: any) {
      console.error("Draft save failed", saveError);
      setError(saveError?.message || "The draft could not be saved.");
      throw saveError;
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
          shipmentRecords: createEmptyInput("t"),
        },
      ],
    }));
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

  const addCarbonPriceRecord = () => {
    setCaseData((previous) => ({
      ...previous,
      carbonPriceRecords: [
        ...previous.carbonPriceRecords,
        {
          id: crypto.randomUUID(),
          amountPaid: "0",
          applicableEmissions: "0",
          currency: "EUR",
          paymentPeriod: String(previous.reportingPeriod.year.value || ""),
          legislationReference: "",
          proofOfPaymentEvidenceId: crypto.randomUUID(),
          eligibleCertificateReduction: "0",
        },
      ],
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
    if (!evidenceForm.issuer.trim() || !evidenceForm.issueDate) {
      setError("Issuer and document date are required before upload.");
      return;
    }

    setUploading(true);
    try {
      const evidenceId = crypto.randomUUID();
      const fileName = safeFileName(file.name);
      const storagePath = `evidence/${sessionUser.uid}/${caseData.caseId}/${evidenceId}/${fileName}`;
      const fileHash = await fileSha256(file);
      const duplicate = caseData.evidenceRegister.some((record) => record.fileHash === fileHash);
      if (duplicate) throw new Error("The same evidence file is already registered in this dossier.");

      await uploadBytes(ref(firebaseStorage, storagePath), file, {
        contentType: file.type,
        customMetadata: {
          evidenceId,
          caseId: caseData.caseId,
          sha256: fileHash,
        },
      });

      const evidence: EvidenceRecord = {
        evidenceId,
        documentType: evidenceForm.documentType,
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
        supportStatus: "SUPPORTED",
        confidentiality: "CONFIDENTIAL",
        linkedInputs: [evidenceForm.linkedField],
        linkedCalculations: [],
      };

      const next = linkEvidence(caseData, evidenceForm.linkedField, evidence);
      setCaseData(next);
      await saveDraft(next);
      setMessage("Evidence uploaded, hashed, linked and saved.");
    } catch (uploadError: any) {
      console.error("Evidence upload failed", uploadError);
      setError(uploadError?.message || "Evidence could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const removeEvidence = async (evidence: EvidenceRecord) => {
    setError("");
    try {
      await deleteObject(ref(firebaseStorage, evidence.storagePath));
      const next = cloneCase(caseData) as any;
      next.evidenceRegister = next.evidenceRegister.filter((item: EvidenceRecord) => item.evidenceId !== evidence.evidenceId);
      for (const path of evidence.linkedInputs) {
        const datum = getPath(next, path);
        if (datum?.evidenceId === evidence.evidenceId) {
          datum.evidenceId = undefined;
          datum.documentReference = undefined;
          datum.confidenceStatus = "LOW_ESTIMATE";
          datum.sourceType = "ESTIMATED";
        }
      }
      setCaseData(next);
      await saveDraft(next);
      setMessage("Evidence removed and linked fields returned to unsupported status.");
    } catch (removeError: any) {
      setError(removeError?.message || "Evidence could not be removed.");
    }
  };

  const handleSeal = async () => {
    if (!caseData.caseId) return;
    if (!readiness.isEligibleForSealing) {
      setError("Resolve all sealing blockers before generating a release.");
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
      await saveDraft(caseData);
      const response = await sealReport(caseData.caseId, entitlement.entitlementId, crypto.randomUUID());
      const reportId = response?.report?.reportId;
      if (!reportId) throw new Error("Release ID was not returned.");
      router.push(`/cbam/reports/${reportId}`);
    } catch (sealError: any) {
      console.error("Sealing failed", sealError);
      setError(sealError?.message || "The release could not be generated. No report version was consumed.");
    } finally {
      setSealing(false);
    }
  };

  const renderStep1 = () => (
    <Section title="1. Case & Reporting Scope" description="Identify the exporter, declarant and reporting period that define this dossier.">
      <Field label="Exporter legal name" value={caseData.exporterIdentity.legalName.value} onChange={(value) => updateValue("exporterIdentity.legalName", value)} />
      <Field label="Importer/declarant legal name" value={caseData.importerIdentity.legalName.value} onChange={(value) => updateValue("importerIdentity.legalName", value)} />
      <Field label="Declarant EORI number" value={caseData.importerIdentity.eoriNumber.value} onChange={(value) => updateValue("importerIdentity.eoriNumber", value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reporting year" type="number" value={caseData.reportingPeriod.year.value} onChange={(value) => updateValue("reportingPeriod.year", value)} />
        <Field label="Reporting quarter or period" value={caseData.reportingPeriod.quarter.value} onChange={(value) => updateValue("reportingPeriod.quarter", value)} />
      </div>
    </Section>
  );

  const renderStep2 = () => (
    <Section title="2. Goods & Customs Data" description="Add each linked good/CN group included in this installation-year dossier.">
      <div className="space-y-4">
        {caseData.goods.map((good, index) => (
          <div key={index} className="rounded-xl border border-border bg-background p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Good {index + 1}</h3>
              <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, goods: previous.goods.filter((_, itemIndex) => itemIndex !== index) }))} className="text-xs text-red-600 hover:underline">Remove</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="8-digit CN code" value={good.cnCode.value} onChange={(value) => updateValue(`goods.${index}.cnCode`, value)} />
              <label className="text-sm font-semibold text-foreground">
                Sector
                <select value={good.sector} onChange={(event) => setCaseData((previous) => {
                  const next = cloneCase(previous);
                  next.goods[index].sector = event.target.value;
                  return next;
                })} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 font-normal">
                  <option value="IRON_AND_STEEL">Iron and steel</option>
                  <option value="ALUMINIUM">Aluminium</option>
                  <option value="CEMENT">Cement</option>
                  <option value="FERTILISERS">Fertilisers</option>
                  <option value="HYDROGEN">Hydrogen</option>
                  <option value="ELECTRICITY">Electricity</option>
                </select>
              </label>
              <Field label="Production volume (tonnes)" type="number" value={good.productionVolume.value} onChange={(value) => updateValue(`goods.${index}.productionVolume`, value)} />
              <Field label="Shipment quantity / records" type="number" value={good.shipmentRecords.value} onChange={(value) => updateValue(`goods.${index}.shipmentRecords`, value)} />
            </div>
          </div>
        ))}
        <button type="button" onClick={addGood} className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-neutral-soft">
          <Plus className="h-4 w-4" /> Add Good
        </button>
      </div>
    </Section>
  );

  const renderStep3 = () => (
    <Section title="3. Installation & Production Route" description="Define the installation and monitored production boundary.">
      <Field label="Installation name" value={caseData.installation.name.value} onChange={(value) => updateValue("installation.name", value)} />
      <Field label="Country" value={caseData.installation.country.value} onChange={(value) => updateValue("installation.country", value)} />
      <Field label="Production route" value={caseData.installation.productionRoute.value} onChange={(value) => updateValue("installation.productionRoute", value)} />
      <label className="text-sm font-semibold text-foreground">
        System boundary statement
        <textarea value={caseData.installation.systemBoundaries || ""} onChange={(event) => setCaseData((previous) => ({ ...previous, installation: { ...previous.installation, systemBoundaries: event.target.value } }))} rows={5} className="mt-1 w-full rounded-md border border-border bg-background p-3 font-normal" />
      </label>
    </Section>
  );

  const renderStep4 = () => (
    <Section title="4. Embedded Emissions" description="Enter direct activity data and electricity inputs using the units shown.">
      <Field label="Total direct emissions (tCO2e)" type="number" value={caseData.directEmissions.value} onChange={(value) => updateValue("directEmissions", value)} />
      <Field label="Electricity consumed (MWh)" type="number" value={caseData.electricityConsumed.value} onChange={(value) => updateValue("electricityConsumed", value)} />
      <Field label="Grid emission factor (tCO2e/MWh)" type="number" value={caseData.gridEmissionFactor.value} onChange={(value) => updateValue("gridEmissionFactor", value)} />
      <div className="rounded-xl border border-border bg-neutral-soft p-4 text-sm">
        <p className="font-bold">Current preview</p>
        <p className="mt-1 text-muted">Specific embedded emissions: {calculationPreview.totalEmbeddedEmissions} tCO2e/t</p>
        {"error" in calculationPreview && <p className="mt-1 text-red-600">{calculationPreview.error}</p>}
      </div>
    </Section>
  );

  const renderStep5 = () => (
    <Section title="5. Precursors & Adjustments" description="Record relevant precursor emissions and supported carbon-price adjustments.">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Precursors</h3>
          <button type="button" onClick={addPrecursor} className="inline-flex items-center gap-1 text-sm font-semibold text-accent"><Plus className="h-4 w-4" /> Add precursor</button>
        </div>
        {caseData.precursors.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">No precursor records declared. Confirm that this is appropriate for the selected production route.</p>}
        {caseData.precursors.map((precursor, index) => (
          <div key={index} className="grid gap-4 rounded-xl border border-border bg-background p-4 md:grid-cols-2">
            <Field label="Precursor name" value={precursor.name.value} onChange={(value) => updateValue(`precursors.${index}.name`, value)} />
            <Field label="Country of origin" value={precursor.countryOfOrigin.value} onChange={(value) => updateValue(`precursors.${index}.countryOfOrigin`, value)} />
            <Field label="Quantity (t)" type="number" value={precursor.quantity.value} onChange={(value) => updateValue(`precursors.${index}.quantity`, value)} />
            <Field label="Direct emissions (tCO2e)" type="number" value={precursor.directEmissions.value} onChange={(value) => updateValue(`precursors.${index}.directEmissions`, value)} />
            <Field label="Indirect emissions (tCO2e)" type="number" value={precursor.indirectEmissions.value} onChange={(value) => updateValue(`precursors.${index}.indirectEmissions`, value)} />
          </div>
        ))}
      </div>
      <div className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Carbon price paid</h3>
          <button type="button" onClick={addCarbonPriceRecord} className="inline-flex items-center gap-1 text-sm font-semibold text-accent"><Plus className="h-4 w-4" /> Add record</button>
        </div>
        {caseData.carbonPriceRecords.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">No carbon-price adjustment claimed.</p>}
        {caseData.carbonPriceRecords.map((record, index) => (
          <div key={record.id} className="grid gap-4 rounded-xl border border-border bg-background p-4 md:grid-cols-2">
            <Field label="Amount paid" type="number" value={record.amountPaid} onChange={(value) => setCaseData((previous) => { const next = cloneCase(previous); next.carbonPriceRecords[index].amountPaid = value || "0"; return next; })} />
            <Field label="Applicable emissions" type="number" value={record.applicableEmissions} onChange={(value) => setCaseData((previous) => { const next = cloneCase(previous); next.carbonPriceRecords[index].applicableEmissions = value || "0"; return next; })} />
            <Field label="Legal basis" value={record.legislationReference} onChange={(value) => setCaseData((previous) => { const next = cloneCase(previous); next.carbonPriceRecords[index].legislationReference = value; return next; })} />
            <Field label="Eligible certificate reduction" type="number" value={record.eligibleCertificateReduction} onChange={(value) => setCaseData((previous) => { const next = cloneCase(previous); next.carbonPriceRecords[index].eligibleCertificateReduction = value || "0"; return next; })} />
          </div>
        ))}
      </div>
    </Section>
  );

  const renderStep6 = () => (
    <Section title="6. Evidence Register" description="Upload source documents, verify their SHA-256 hashes and link each document to a material dossier field.">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Document type" value={evidenceForm.documentType} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, documentType: value }))} />
        <Field label="Issuer" value={evidenceForm.issuer} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, issuer: value }))} />
        <Field label="Document date" type="date" value={evidenceForm.issueDate} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, issueDate: value }))} />
        <Field label="Page or reference" value={evidenceForm.pageReference} onChange={(value) => setEvidenceForm((previous) => ({ ...previous, pageReference: value }))} />
        <label className="text-sm font-semibold text-foreground md:col-span-2">
          Field supported by this evidence
          <select value={evidenceForm.linkedField} onChange={(event) => setEvidenceForm((previous) => ({ ...previous, linkedField: event.target.value }))} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 font-normal">
            {LINKABLE_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
          </select>
        </label>
      </div>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background p-5 text-center hover:bg-neutral-soft">
        {uploading ? <Loader2 className="mb-2 h-6 w-6 animate-spin text-accent" /> : <UploadCloud className="mb-2 h-6 w-6 text-accent" />}
        <span className="text-sm font-semibold">{uploading ? "Uploading and hashing…" : "Choose evidence file"}</span>
        <span className="mt-1 text-xs text-muted">PDF, CSV, XLS/XLSX, PNG, JPEG or TXT — maximum 20 MB</span>
        <input type="file" className="sr-only" disabled={uploading} accept=".pdf,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.txt" onChange={(event) => uploadEvidence(event.target.files?.[0] || null)} />
      </label>
      <div className="space-y-3">
        {caseData.evidenceRegister.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">No evidence uploaded. Sealing remains blocked.</p>}
        {caseData.evidenceRegister.map((evidence) => (
          <div key={evidence.evidenceId} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{evidence.fileName}</p>
              <p className="mt-1 text-xs text-muted">{evidence.documentType} · linked to {evidence.linkedInputs.join(", ")}</p>
              <p className="mt-1 truncate font-mono text-[10px] text-muted" title={evidence.fileHash}>SHA-256: {evidence.fileHash}</p>
            </div>
            <button type="button" onClick={() => removeEvidence(evidence)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><Trash2 className="h-4 w-4" /> Remove</button>
          </div>
        ))}
      </div>
    </Section>
  );

  const renderStep7 = () => (
    <Section title="7. Quality Review" description="Resolve every blocker before purchasing or sealing a final release.">
      <div className={`rounded-xl border p-5 ${readiness.isEligibleForSealing ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
        <p className="font-bold">{readiness.status}</p>
        <p className="mt-1 text-sm">Completeness: {readiness.completenessPercentage}%</p>
      </div>
      <div className="space-y-3">
        {readiness.allGaps.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 p-4 text-sm font-semibold text-green-800"><CheckCircle2 className="h-5 w-5" /> No open readiness findings.</div>
        ) : readiness.allGaps.map((gap) => (
          <div key={gap.gapId} className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold">{gap.requirement}</p>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold">{gap.severity}</span>
            </div>
            <p className="mt-2 text-sm text-muted">{gap.whyItMatters}</p>
            <p className="mt-2 text-sm"><strong>Required action:</strong> {gap.suggestedAction}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-neutral-soft p-4">
        <p className="font-bold">Calculation trace preview</p>
        <p className="mt-1 text-sm text-muted">{calculationPreview.trace.length} calculation nodes · result {calculationPreview.totalEmbeddedEmissions}</p>
      </div>
    </Section>
  );

  const renderStep8 = () => (
    <Section title="8. Seal & Deliverables" description="Generate one immutable, integrity-verified verifier-preparation release after all blockers are resolved.">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-background p-5">
          <Shield className="mb-3 h-6 w-6 text-accent" />
          <h3 className="font-bold">Release readiness</h3>
          <p className="mt-2 text-sm text-muted">Status: {readiness.status}</p>
          <p className="mt-1 text-sm text-muted">Available versions for this dossier: {caseEntitlements.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-5">
          <FileText className="mb-3 h-6 w-6 text-accent" />
          <h3 className="font-bold">Final delivery</h3>
          <p className="mt-2 text-sm text-muted">23 top-level components, supporting evidence, calculation trace, O3CI mapping and a SHA-256 integrity manifest.</p>
        </div>
      </div>

      {!caseEntitlements.length ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-bold text-amber-900">No active Preparation Pack is linked to this dossier.</p>
          <p className="mt-2 text-sm text-amber-800">Draft preparation remains free. Purchase the $150 pack only when the dossier is ready to seal.</p>
          <Link href="/credits/buy" className="mt-4 inline-flex h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-surface">Purchase Preparation Pack — $150</Link>
        </div>
      ) : (
        <button type="button" onClick={handleSeal} disabled={!readiness.isEligibleForSealing || sealing} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-6 font-semibold text-surface hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
          {sealing ? <><Loader2 className="h-5 w-5 animate-spin" /> Generating verified package…</> : "Seal One Version & Generate Package"}
        </button>
      )}
      <p className="text-xs leading-relaxed text-muted">A blocked or failed generation consumes no version. Re-downloading an existing release consumes no version. CBAMValid prepares the dossier for independent verification and does not issue an accredited verification opinion or acceptance guarantee.</p>
    </Section>
  );

  const content = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8][currentStep - 1]();

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-28 text-foreground md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold font-serif">Exporter Verification Preparation Dossier</h1>
            <p className="mt-1 text-xs font-mono text-muted">Case ID: {caseData.caseId}</p>
          </div>
          <button type="button" onClick={() => saveDraft()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-surface px-5 text-sm font-semibold hover:bg-neutral-soft disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{saving ? "Saving…" : "Save Draft"}
          </button>
        </div>

        {(message || error) && (
          <div role={error ? "alert" : "status"} className={`rounded-lg border p-4 text-sm ${error ? "border-red-300 bg-red-50 text-red-800" : "border-green-300 bg-green-50 text-green-800"}`}>
            {error || message}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 overflow-x-auto md:grid-cols-8">
          {STEPS.map((step) => (
            <button key={step.id} type="button" onClick={() => setCurrentStep(step.id)} className={`min-w-24 rounded-lg border p-3 text-center transition-colors ${currentStep === step.id ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:text-foreground"}`}>
              <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs font-bold">{step.id}</span>
              <span className="mt-2 block text-[10px] font-bold uppercase leading-tight">{step.label}</span>
            </button>
          ))}
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
  return (
    <section className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm md:p-8">
      <div>
        <h2 className="text-xl font-bold font-serif">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: unknown; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-sm font-semibold text-foreground">
      {label}
      <input type={type} value={value === null || value === undefined ? "" : String(value)} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3 font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" />
    </label>
  );
}
