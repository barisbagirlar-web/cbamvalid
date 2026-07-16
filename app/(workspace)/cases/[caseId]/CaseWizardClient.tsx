"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileCode2,
  FileUp,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
} from "lucide-react";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";
import { getDisplayReferenceCode } from "@/lib/cbam/case-id";
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

// Compliance check declaration
const fieldHelpData = {
  "exporterIdentity.legalName": {
    title: "Exporter Legal Name",
    source: "Official corporate registration certificate, business license, or national commercial registry records.",
    tip: "Must match character-for-character with the exporter name shown on the commercial invoice, bill of lading, and EU customs declaration. Any slight spelling variation (e.g., 'Ltd' vs 'Limited') can flag the dossier during audits.",
    basis: "Regulation (EU) 2023/1773 implementing rules, Annex I Section 1."
  },
  "importerIdentity.legalName": {
    title: "Importer Legal Name",
    source: "EU Customs import declaration form (SAD), commercial invoices, or importer business registration certificates.",
    tip: "Enter the official registered corporate name of the EU customs declarant. Must match character-for-character with the importer name shown on the customs entry documents.",
    basis: "Regulation (EU) 2023/1773, Annex I Section 1."
  },
  "importerIdentity.eoriNumber": {
    title: "Declarant EORI Number",
    source: "The EU importer's Economic Operators Registration and Identification (EORI) number. Found on customs clearance document SAD (Single Administrative Document) or importer registration certificates.",
    tip: "Always verify the EORI via the EU Commission's public EORI validation tool. The format is a country code followed by up to 15 digits (e.g., NL123456789). Do not use local tax IDs or vat numbers.",
    basis: "Regulation (EU) 2023/1773 Article 2."
  },
  "reportingPeriod.year": {
    title: "Reporting Year",
    source: "The calendar year of importations for which this CBAM report is being prepared.",
    tip: "Select the calendar year (e.g. 2026). CBAM declarations follow the calendar year cycle. Split reporting periods are not allowed.",
    basis: "Regulation (EU) 2023/956 Article 6."
  },
  "reportingPeriod.quarter": {
    title: "Reporting Quarter",
    source: "The specific calendar quarter matching the customs entry dates of the imported goods.",
    tip: "Select the calendar quarter (Q1-Q4). Submissions must match the quarterly declaration requirements in the Transitional Registry.",
    basis: "Regulation (EU) 2023/1773 Article 3."
  },
  "goods.cnCode": {
    title: "CN Code (Tariff Classification)",
    source: "The 8-digit Combined Nomenclature (CN) code for the goods, found in Box 33 of the customs declaration (SAD), commercial invoices, or bills of lading.",
    tip: "Ensure the CN code is valid for the current reporting year. The first 4 digits determine the CBAM sector (e.g., 7208 for steel). Double check the product boundary since the CN code determines the required precursors.",
    basis: "Regulation (EU) 2023/956, Annex I."
  },
  "goods.sector": {
    title: "CBAM Sector",
    source: "Annex I of the CBAM Regulation.",
    tip: "The sector is automatically determined by the CN code of the product. It determines the system boundary and the list of mandatory precursors.",
    basis: "Regulation (EU) 2023/956, Annex I."
  },
  "goods.productionVolume": {
    title: "Production Volume",
    source: "Internal production registers, ERP inventory reports, workshop output logs, or weighbridge invoices.",
    tip: "Report total quantity in metric tonnes (t). Exclude all packaging materials (pallets, straps, plastic wraps). Convert kg to tonnes by dividing by 1,000 (e.g., 1500 kg = 1.50 tonnes).",
    basis: "Regulation (EU) 2023/1773, Annex III Section A."
  },
  "goods.shipmentRecords": {
    title: "Shipment/Import Records",
    source: "Customs declaration files, bills of lading, and freight logs.",
    tip: "Provide references to the shipment numbers, customs declarations, or invoices covered under this reporting period for validation.",
    basis: "Regulation (EU) 2023/1773, Annex I."
  },
  "goods.allocationShare": {
    title: "Production Allocation Share",
    source: "Internal production share calculations or mass balance logs.",
    tip: "Specify the fraction (between 0 and 1) of the installation's total emissions allocated to this specific good. Total allocation share for all goods cannot exceed 1.",
    basis: "Regulation (EU) 2023/1773, Annex III Section F."
  },
  "installation.name": {
    title: "Facility (Installation) Name",
    source: "The official name of the physical plant. Found on environmental permits, greenhouse gas emission authorization letters, or land registries.",
    tip: "Must correspond exactly to the installation name submitted in the Monitoring Plan. If your organization operates multiple production lines in different locations, make sure to specify the name of the exact physical unit where the goods were produced.",
    basis: "Regulation (EU) 2023/1773, Annex I Section 1.2."
  },
  "installation.country": {
    title: "Installation Country",
    source: "The country where the physical production plant is located.",
    tip: "Enter the ISO country name or code of the country of origin. This determines the default emission factors and national electricity grid mix factors applied.",
    basis: "Regulation (EU) 2023/1773, Annex I."
  },
  "installation.productionRoute": {
    title: "Production Route",
    source: "Technical specifications of the plant, manufacturing flow diagrams, or the facility's approved Monitoring Plan.",
    tip: "You must choose the specific technology route defined by the European Commission for this CN code (e.g., 'Blast furnace route' or 'Electric arc furnace' for steel). Generic commercial process names will be rejected by verifiers.",
    basis: "Regulation (EU) 2023/1773, Annex II."
  },
  "installation.systemBoundaries": {
    title: "System Boundaries",
    source: "Process flowcharts, environmental permits, and production system limits.",
    tip: "Describe the physical system boundaries of the production process, including included emission sources, precursor entry points, and production routes.",
    basis: "Regulation (EU) 2023/1773, Annex III Section A."
  },
  "directEmissions": {
    title: "Total Direct Emissions",
    source: "Annual greenhouse gas emissions reports, national ETS compliance declarations, or calculated fuel consumption records using certified emission factors.",
    tip: "Only include emissions within the boundaries of the specific CBAM production process (system boundaries). Exclude emissions from unrelated services, offices, off-site shipping, or downstream processing units (like coating/slitting).",
    basis: "Regulation (EU) 2023/1773, Annex III Section B.3."
  },
  "electricityConsumed": {
    title: "Electricity Consumed",
    source: "Energy meter readings, monthly utility billing invoices, or factory sub-meters dedicated to the specific production line.",
    tip: "Report only electricity consumed within the process boundary of the declared good. Allocate shared factory electricity based on running hours or output weight. Convert kWh to MWh by dividing by 1,000.",
    basis: "Regulation (EU) 2023/1773, Annex III Section B.4."
  },
  "gridEmissionFactor": {
    title: "Grid Emission Factor",
    source: "Official statistics published by the national grid operator or energy ministry, or the default emission factor dataset published by the European Commission for the country of origin.",
    tip: "PPAs (Power Purchase Agreements) can only be used if there is a direct physical link or strict grid-level tracking that satisfies Article B.4.3. Otherwise, you must use the national average grid mix factor.",
    basis: "Regulation (EU) 2023/1773, Annex III Section B.4.3."
  },
  "precursors.name": {
    title: "Precursor Material Name",
    source: "Purchase invoices, technical specs, or supplier declarations.",
    tip: "Specify the exact commercial or technical name of the precursor good used (e.g., 'Pig iron' or 'Aluminium scrap') as defined in the CBAM precursors list.",
    basis: "Regulation (EU) 2023/1773, Annex III Section E."
  },
  "precursors.countryOfOrigin": {
    title: "Precursor Country of Origin",
    source: "Certificate of origin, shipping papers, or purchase contracts.",
    tip: "Enter the country where the precursor was produced. This determines the regulatory factors applied in case default values are checked.",
    basis: "Regulation (EU) 2023/1773, Annex I."
  },
  "precursors.quantity": {
    title: "Precursor Quantity Used",
    source: "Warehouse inventory registers, recipe logs, or production batches.",
    tip: "Report the total quantity of this precursor consumed in production of the good, in metric tonnes (t). Convert kg to tonnes.",
    basis: "Regulation (EU) 2023/1773, Annex III Section E."
  },
  "precursors.directEmissions": {
    title: "Precursor Direct Emissions",
    source: "CBAM definitive report or verification declaration provided by the precursor supplier.",
    tip: "Report the direct embedded emissions of the precursor, in tCO2e per tonne of precursor. Must be based on actual calculations from the supplier.",
    basis: "Regulation (EU) 2023/1773, Annex III Section E."
  },
  "precursors.indirectEmissions": {
    title: "Precursor Indirect Emissions",
    source: "Supplier verification reports or calculations based on their electricity consumption.",
    tip: "Report the indirect embedded emissions of the precursor, in tCO2e per tonne of precursor. Must reflect supplier's actual power source mix.",
    basis: "Regulation (EU) 2023/1773, Annex III Section E."
  },
  "precursorEmissions": {
    title: "Precursor Emissions Guidelines",
    source: "CBAM declarations or definitive evidence reports obtained directly from the suppliers of precursor materials.",
    tip: "If precursor suppliers do not provide actual emission data, default values cannot be used after the transitional period. Incomplete precursor data can block the sealing of the final exporter dossier.",
    basis: "Regulation (EU) 2023/1773 Article 4 and Annex III Section E."
  },
  "carbonPricePaid.amountPaid": {
    title: "Carbon Price Paid - Amount Paid",
    source: "ETS compliance accounts, carbon tax filings, or energy tax payment records in the country of origin.",
    tip: "Only carbon prices directly paid for embedded emissions are deductible. You must deduct any free allocations, tax rebates, or direct subsidies received.",
    basis: "Regulation (EU) 2023/956 Article 9."
  },
  "carbonPricePaid.applicableEmissions": {
    title: "Carbon Price Paid - Applicable Emissions",
    source: "Tax records or ETS system declarations indicating the emissions volume covered by the payment.",
    tip: "Specify the exact quantity of emissions (in tCO2e) that were subject to the carbon price payment in the local jurisdiction.",
    basis: "Regulation (EU) 2023/956 Article 9."
  },
  "carbonPricePaid.currency": {
    title: "Carbon Price Paid - Currency",
    source: "Local tax invoicing and payment records.",
    tip: "Select the currency in which the carbon price was paid (EUR, USD, GBP, TRY). The system will resolve exchange rate conversions if necessary.",
    basis: "Regulation (EU) 2023/956 Article 9."
  },
  "carbonPricePaid.legislationReference": {
    title: "Carbon Price Paid - Legislation Reference",
    source: "Official legislative gazettes, carbon tax laws, or ETS rules.",
    tip: "Provide the name and article number of the national legislation or scheme under which the carbon price was paid.",
    basis: "Regulation (EU) 2023/956 Article 9."
  },
  "carbonPricePaid.proofOfPaymentEvidenceId": {
    title: "Carbon Price Paid - Payment Evidence",
    source: "Bank transfer slips, government receipts, or verified ETS transaction statements.",
    tip: "Link to the uploaded evidence document proving the actual payment of the carbon price. Unlinked price deductions will fail verification.",
    basis: "Regulation (EU) 2023/956 Article 9."
  },
  "carbonPricePaid": {
    title: "Carbon Price Paid Guidelines",
    source: "ETS compliance accounts, carbon tax filings, or energy tax payment records in the country of origin.",
    tip: "Only carbon prices directly paid for embedded emissions are deductible. You must deduct any free allocations, tax rebates, or direct subsidies received. Convert the final amount to EUR.",
    basis: "Regulation (EU) 2023/956 Article 9."
  },
  "evidence.file": {
    title: "Evidence File Upload",
    source: "Digital copy of physical registers, permits, invoices, or utility bills.",
    tip: "Upload a clean PDF, CSV, Excel, or Image file. Maximum size is 20MB. Make sure the file hash is computable and matches the local file bytes.",
    basis: "Regulation (EU) 2023/1773, Annex III."
  },
  "evidence.documentType": {
    title: "Evidence Document Type",
    source: "The category of the uploaded document.",
    tip: "Select the standard category for this file (e.g. Monitoring Plan, Utility Invoice, Emissions Report, Customs Entry). This maps to the verifier package registry.",
    basis: "Regulation (EU) 2023/1773, Annex III Section A."
  },
  "evidence.issuer": {
    title: "Document Issuer",
    source: "The company, government agency, utility company, or testing lab that signed or issued the file.",
    tip: "Enter the legal name of the entity that issued the document (e.g. 'Turkish Ministry of Environment' or 'Gedik Electric Utility Ltd').",
    basis: "Regulation (EU) 2023/1773, Annex III."
  },
  "evidence.issueDate": {
    title: "Document Issue Date",
    source: "The date shown on the document stamp, signature line, or header.",
    tip: "Enter the exact date when this document was issued (e.g. 2026-03-15). Must correspond to the reporting period relevance.",
    basis: "Regulation (EU) 2023/1773, Annex III."
  },
  "evidence.linkedInput": {
    title: "Linked Data Field",
    source: "The specific data input in this wizard that is supported by this document.",
    tip: "Choose the target input path that this document directly proves. Verifiers require 100% evidence coverage for all material fields.",
    basis: "Regulation (EU) 2023/1773, Annex III."
  }
};

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
  const parts = path.split(String.fromCharCode(46));
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-bold text-foreground">{children}</label>;
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
  const [saving, setSaving] = useState(false);
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
  const [activeHelpPath, setActiveHelpPath] = useState<string | null>(null);

  const renderHelpBox = (path: string) => {
    const data = fieldHelpData[path as keyof typeof fieldHelpData];
    if (!data) return null;
    return (
      <div className="mt-2 p-4 bg-accent-soft border border-accent/15 rounded-lg text-xs space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
        <div className="flex items-center gap-1.5 font-bold text-accent">
          <CircleAlert className="w-4 h-4 shrink-0" />
          <span>{data.title} Guidelines</span>
        </div>
        <div className="space-y-1.5 text-foreground/90 leading-relaxed">
          <p>
            <strong className="text-foreground">Where to find:</strong> {data.source}
          </p>
          <p>
            <strong className="text-foreground">Audit Pro-Tip:</strong> {data.tip}
          </p>
          <p className="text-[10px] text-text-muted font-mono pt-1.5 border-t border-border">
            <strong>Regulatory Reference:</strong> {data.basis}
          </p>
        </div>
      </div>
    );
  };

  const renderFieldLabelWithTips = (label: string, helpPath: string) => {
    return (
      <div className="flex items-center justify-between mb-1">
        <FieldLabel>{label}</FieldLabel>
        {fieldHelpData[helpPath as keyof typeof fieldHelpData] && (
          <button
            type="button"
            onClick={() => setActiveHelpPath(activeHelpPath === helpPath ? null : helpPath)}
            className="text-[11px] text-accent hover:text-accent-hover font-semibold flex items-center gap-1 cursor-pointer transition-colors font-sans"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Tips
          </button>
        )}
      </div>
    );
  };

  const readiness = useMemo(() => assessCaseReadiness(caseData), [caseData]);
  const calculation = useMemo(() => {
    try {
      return { result: performDossierCalculations(caseData), error: "" };
    } catch (error) {
      return { result: null, error: errorMessage(error) };
    }
  }, [caseData]);

  const usableEntitlements = useMemo(() => availableEntitlements.filter((entitlement) => {
    const status = String(entitlement.status || "").toUpperCase();
    const caseMatches = !entitlement.caseId || entitlement.caseId === caseData.caseId;
    return caseMatches && ["AVAILABLE", "ACTIVE", "PURCHASED"].includes(status);
  }), [availableEntitlements, caseData.caseId]);

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
      const response = await sealReport(caseData.caseId, entitlementId, sealRequestId.current);
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
          ["reportingPeriod.year", "Reporting year", "number"],
          ["reportingPeriod.quarter", "Reporting period / quarter", "text"],
        ].map(([path, label, type]) => {
          const parts = path.split(String.fromCharCode(46));
          const datum = parts.reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], caseData) as InputDatum;
          return (
            <div key={path}>
              {renderFieldLabelWithTips(label, path)}
              <input aria-label={label} type={type} value={datumValue(datum.value)} onChange={(event) => updateDatum(path, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
              {activeHelpPath === path && renderHelpBox(path)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">2. Goods</h2><button type="button" onClick={addGood} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface"><Plus className="h-4 w-4" /> Add good</button></div>
      {caseData.goods.length === 0 && <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No goods declared.</div>}
      {caseData.goods.map((good, index) => (
        <div key={`good-${index}`} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
          <div>
            {renderFieldLabelWithTips("CN code", "goods.cnCode")}
            <input aria-label={`Good ${index + 1} CN code`} inputMode="numeric" value={datumValue(good.cnCode.value)} onChange={(event) => updateDatum(`goods.${index}.cnCode`, { value: event.target.value.replace(/\D/g, "").slice(0, 8) })} className="w-full rounded border border-border bg-background p-2 text-sm" />
            {activeHelpPath === "goods.cnCode" && renderHelpBox("goods.cnCode")}
          </div>
          <div>
            {renderFieldLabelWithTips("CBAM sector", "goods.sector")}
            <select aria-label={`Good ${index + 1} sector`} value={good.sector} onChange={(event) => updatePlain(`goods.${index}.sector`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{SECTORS.map((sector) => <option key={sector} value={sector}>{sector.replaceAll("_", " ")}</option>)}</select>
            {activeHelpPath === "goods.sector" && renderHelpBox("goods.sector")}
          </div>
          <div>
            {renderFieldLabelWithTips("Production quantity", "goods.productionVolume")}
            <input aria-label={`Good ${index + 1} production quantity`} type="number" min="0" step="any" value={datumValue(good.productionVolume.value)} onChange={(event) => updateDatum(`goods.${index}.productionVolume`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
            {activeHelpPath === "goods.productionVolume" && renderHelpBox("goods.productionVolume")}
          </div>
          <div>
            {renderFieldLabelWithTips("Production unit", "goods.productionVolume")}
            <select aria-label={`Good ${index + 1} production unit`} value={good.productionVolume.canonicalUnit || "t"} onChange={(event) => updateDatum(`goods.${index}.productionVolume`, { canonicalUnit: event.target.value as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="t">tonnes</option><option value="kg">kilograms</option></select>
            {activeHelpPath === "goods.productionVolume" && renderHelpBox("goods.productionVolume")}
          </div>
          <div>
            {renderFieldLabelWithTips("Shipment / product description", "goods.shipmentRecords")}
            <input aria-label={`Good ${index + 1} shipment description`} value={datumValue(good.shipmentRecords.value)} onChange={(event) => updateDatum(`goods.${index}.shipmentRecords`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
            {activeHelpPath === "goods.shipmentRecords" && renderHelpBox("goods.shipmentRecords")}
          </div>
          {caseData.goods.length > 1 && (
            <div>
              {renderFieldLabelWithTips("Allocation share (0–1)", "goods.allocationShare")}
              <input aria-label={`Good ${index + 1} allocation share`} type="number" min="0" max="1" step="0.000001" value={datumValue(good.allocationShare?.value ?? null)} onChange={(event) => updateDatum(`goods.${index}.allocationShare`, { value: event.target.value, canonicalUnit: "fraction" })} className="w-full rounded border border-border bg-background p-2 text-sm" />
              {activeHelpPath === "goods.allocationShare" && renderHelpBox("goods.allocationShare")}
            </div>
          )}
          <div className="md:col-span-2 pt-2 border-t border-border/30 flex justify-end">
            <button type="button" onClick={() => removeGood(index)} className="inline-flex items-center gap-2 text-sm text-red-700 font-semibold hover:text-red-800 transition-colors"><Trash2 className="h-4 w-4" /> Remove good</button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6"><h2 className="text-xl font-bold">3. Installation and system boundary</h2><div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-2">
      <div>
        {renderFieldLabelWithTips("Installation name", "installation.name")}
        <input aria-label="Installation name" value={datumValue(caseData.installation.name.value)} onChange={(event) => updateDatum("installation.name", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
        {activeHelpPath === "installation.name" && renderHelpBox("installation.name")}
      </div>
      <div>
        {renderFieldLabelWithTips("Installation country", "installation.country")}
        <input aria-label="Installation country" value={datumValue(caseData.installation.country.value)} onChange={(event) => updateDatum("installation.country", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
        {activeHelpPath === "installation.country" && renderHelpBox("installation.country")}
      </div>
      <div>
        {renderFieldLabelWithTips("Production route", "installation.productionRoute")}
        <input aria-label="Production route" value={datumValue(caseData.installation.productionRoute.value)} onChange={(event) => updateDatum("installation.productionRoute", { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
        {activeHelpPath === "installation.productionRoute" && renderHelpBox("installation.productionRoute")}
      </div>
      <div className="md:col-span-2">
        {renderFieldLabelWithTips("System-boundary statement", "installation.systemBoundaries")}
        <textarea aria-label="System-boundary statement" value={caseData.installation.systemBoundaries || ""} onChange={(event) => updatePlain("installation.systemBoundaries", event.target.value)} rows={5} className="w-full rounded border border-border bg-background p-2 text-sm" />
        {activeHelpPath === "installation.systemBoundaries" && renderHelpBox("installation.systemBoundaries")}
      </div>
    </div></div>
  );

  const emissionInput = (path: "directEmissions" | "electricityConsumed" | "gridEmissionFactor", label: string, unit: UnitCode) => {
    const datum = caseData[path];
    return <div className="grid gap-4 rounded-xl border border-border bg-surface p-6 md:grid-cols-3">
      <div>
        {renderFieldLabelWithTips(label, path)}
        <input aria-label={label} type="number" min="0" step="any" value={datumValue(datum.value)} onChange={(event) => updateDatum(path, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
        {activeHelpPath === path && renderHelpBox(path)}
      </div>
      <div>
        <FieldLabel>Unit</FieldLabel>
        <select aria-label={`${label} unit`} value={datum.canonicalUnit || unit} onChange={(event) => updateDatum(path, { canonicalUnit: event.target.value as UnitCode })} className="w-full rounded border border-border bg-background p-2 text-sm"><option value={unit}>{unit}</option></select>
      </div>
      <div>
        <FieldLabel>Source type</FieldLabel>
        <select aria-label={`${label} source type`} value={datum.sourceType} onChange={(event) => updateDatum(path, { sourceType: event.target.value as InputDatum["sourceType"] })} className="w-full rounded border border-border bg-background p-2 text-sm">{SOURCE_TYPES.map((source) => <option key={source} value={source}>{source}</option>)}</select>
      </div>
    </div>;
  };

  const renderStep4 = () => <div className="space-y-6"><h2 className="text-xl font-bold">4. Direct emissions</h2>{emissionInput("directEmissions", "Total direct emissions", "tCO2e")}</div>;
  const renderStep5 = () => <div className="space-y-6"><h2 className="text-xl font-bold">5. Indirect emissions</h2>{emissionInput("electricityConsumed", "Electricity consumed", "MWh")}{emissionInput("gridEmissionFactor", "Grid emission factor", "tCO2e/MWh")}</div>;

  const renderStep6 = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold">6. Precursors and methodology decisions</h2><button type="button" onClick={addPrecursor} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface"><Plus className="h-4 w-4" /> Add precursor</button></div>
      
      {caseData.precursors.length === 0 && (
        <div className="rounded-xl border border-border bg-accent-soft p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">No Precursors Scope Decision</h4>
            <p className="text-xs text-muted">If this installation does not use any CBAM precursor materials, you must document this official scope decision.</p>
          </div>
          <button type="button" onClick={() => addMethodologyDecision("PRECURSOR_SCOPE")} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-surface hover:bg-accent-hover transition-colors shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Record decision
          </button>
        </div>
      )}

      {caseData.precursors.map((precursor, index) => (
        <div key={`precursor-${index}`} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
          <div>
            {renderFieldLabelWithTips("Precursor name", "precursors.name")}
            <input aria-label={`Precursor ${index + 1} Precursor name`} value={datumValue(precursor.name.value)} onChange={(event) => updateDatum(`precursors.${index}.name`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
            {activeHelpPath === "precursors.name" && renderHelpBox("precursors.name")}
          </div>
          <div>
            {renderFieldLabelWithTips("Country of origin", "precursors.countryOfOrigin")}
            <input aria-label={`Precursor ${index + 1} Country of origin`} value={datumValue(precursor.countryOfOrigin.value)} onChange={(event) => updateDatum(`precursors.${index}.countryOfOrigin`, { value: event.target.value })} className="w-full rounded border border-border bg-background p-2 text-sm" />
            {activeHelpPath === "precursors.countryOfOrigin" && renderHelpBox("precursors.countryOfOrigin")}
          </div>
          <div>
            {renderFieldLabelWithTips("Quantity (t)", "precursors.quantity")}
            <input aria-label={`Precursor ${index + 1} Quantity`} type="number" min="0" step="any" value={datumValue(precursor.quantity.value)} onChange={(event) => updateDatum(`precursors.${index}.quantity`, { value: event.target.value, canonicalUnit: "t" })} className="w-full rounded border border-border bg-background p-2 text-sm" />
            {activeHelpPath === "precursors.quantity" && renderHelpBox("precursors.quantity")}
          </div>
          <div>
            {renderFieldLabelWithTips("Direct emissions (tCO2e)", "precursors.directEmissions")}
            <input aria-label={`Precursor ${index + 1} Direct emissions`} type="number" min="0" step="any" value={datumValue(precursor.directEmissions.value)} onChange={(event) => updateDatum(`precursors.${index}.directEmissions`, { value: event.target.value, canonicalUnit: "tCO2e" })} className="w-full rounded border border-border bg-background p-2 text-sm" />
            {activeHelpPath === "precursors.directEmissions" && renderHelpBox("precursors.directEmissions")}
          </div>
          <div>
            {renderFieldLabelWithTips("Indirect emissions (tCO2e)", "precursors.indirectEmissions")}
            <input aria-label={`Precursor ${index + 1} Indirect emissions`} type="number" min="0" step="any" value={datumValue(precursor.indirectEmissions.value)} onChange={(event) => updateDatum(`precursors.${index}.indirectEmissions`, { value: event.target.value, canonicalUnit: "tCO2e" })} className="w-full rounded border border-border bg-background p-2 text-sm" />
            {activeHelpPath === "precursors.indirectEmissions" && renderHelpBox("precursors.indirectEmissions")}
          </div>
          <div className="md:col-span-2 pt-2 border-t border-border/30 flex justify-end">
            <button type="button" onClick={() => setCaseData((previous) => ({ ...previous, precursors: previous.precursors.filter((_, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center gap-2 text-sm text-red-700 font-semibold hover:text-red-800 transition-colors"><Trash2 className="h-4 w-4" /> Remove precursor</button>
          </div>
        </div>
      ))}

      {caseData.goods.length > 1 && (
        <div className="rounded-xl border border-border bg-accent-soft p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">Multi-Good Emissions Allocation</h4>
            <p className="text-xs text-muted">For facilities producing multiple CBAM products, you must record the official methodology used to allocate shared emissions.</p>
          </div>
          <button type="button" onClick={() => addMethodologyDecision("GOODS_EMISSIONS_ALLOCATION")} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-surface hover:bg-accent-hover transition-colors shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Record allocation method
          </button>
        </div>
      )}

      <div className="space-y-3">
        {caseData.methodologyDecisions.map((decision) => (
          <div key={decision.decisionId} className="rounded-xl border border-border bg-surface p-4 flex items-start gap-3 shadow-[var(--shadow-card)]">
            <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-emerald-800">{decision.topic.replaceAll("_", " ")}</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold border border-emerald-100">{decision.reviewStatus}</span>
              </div>
              <p className="text-sm font-semibold">{decision.selectedMethod}</p>
              <div className="flex gap-3 text-xs text-muted pt-1">
                <span>Basis: {decision.legalOrTechnicalBasis}</span>
                <span>•</span>
                <span>Ruleset: {decision.rulesetVersion}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCaseData((prev) => ({
                ...prev,
                methodologyDecisions: prev.methodologyDecisions.filter((d) => d.decisionId !== decision.decisionId)
              }))}
              className="text-xs text-red-600 hover:text-red-700 font-semibold text-right"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-8"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">7. Carbon price and evidence register</h2><button type="button" onClick={addCarbonPriceRecord} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-sm"><Plus className="h-4 w-4" /> Add carbon-price record</button></div>
      {caseData.carbonPriceRecords.map((record, index) => <div key={record.id} className="grid gap-4 rounded-xl border border-border bg-surface p-5 md:grid-cols-2">
        <div>
          {renderFieldLabelWithTips("Amount paid", "carbonPricePaid.amountPaid")}
          <input aria-label={`Carbon price ${index + 1} amount paid`} type="number" min="0" step="any" value={record.amountPaid} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.amountPaid`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" />
          {activeHelpPath === "carbonPricePaid.amountPaid" && renderHelpBox("carbonPricePaid.amountPaid")}
        </div>
        <div>
          {renderFieldLabelWithTips("Applicable emissions", "carbonPricePaid.applicableEmissions")}
          <input aria-label={`Carbon price ${index + 1} applicable emissions`} type="number" min="0" step="any" value={record.applicableEmissions} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.applicableEmissions`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" />
          {activeHelpPath === "carbonPricePaid.applicableEmissions" && renderHelpBox("carbonPricePaid.applicableEmissions")}
        </div>
        <div>
          {renderFieldLabelWithTips("Currency", "carbonPricePaid.currency")}
          <select aria-label={`Carbon price ${index + 1} currency`} value={record.currency} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.currency`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{["EUR", "USD", "GBP", "TRY"].map((currency) => <option key={currency}>{currency}</option>)}</select>
          {activeHelpPath === "carbonPricePaid.currency" && renderHelpBox("carbonPricePaid.currency")}
        </div>
        <div>
          {renderFieldLabelWithTips("Legislation reference", "carbonPricePaid.legislationReference")}
          <input aria-label={`Carbon price ${index + 1} legislation reference`} value={record.legislationReference} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.legislationReference`, event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" />
          {activeHelpPath === "carbonPricePaid.legislationReference" && renderHelpBox("carbonPricePaid.legislationReference")}
        </div>
        <div className="md:col-span-2">
          {renderFieldLabelWithTips("Payment evidence", "carbonPricePaid.proofOfPaymentEvidenceId")}
          <select aria-label={`Carbon price ${index + 1} payment evidence`} value={record.proofOfPaymentEvidenceId || ""} onChange={(event) => updatePlain(`carbonPriceRecords.${index}.proofOfPaymentEvidenceId`, event.target.value || undefined)} className="w-full rounded border border-border bg-background p-2 text-sm"><option value="">Select evidence</option>{caseData.evidenceRegister.map((evidence) => <option key={evidence.evidenceId} value={evidence.evidenceId}>{evidence.fileName}</option>)}</select>
          {activeHelpPath === "carbonPricePaid.proofOfPaymentEvidenceId" && renderHelpBox("carbonPricePaid.proofOfPaymentEvidenceId")}
        </div>
      </div>)}

      <div className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]"><h3 className="font-bold">Upload immutable evidence</h3><div className="grid gap-4 md:grid-cols-2">
        <div>
          {renderFieldLabelWithTips("File", "evidence.file")}
          <div className="relative mt-1">
            <input
              id="custom-file-upload"
              type="file"
              className="hidden"
              accept=".pdf,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
              onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => document.getElementById("custom-file-upload")?.click()}
              className="w-full flex items-center justify-between rounded border border-border bg-background p-2 text-sm hover:bg-neutral-soft transition-colors text-left"
            >
              <span className="text-muted truncate">
                {evidenceFile ? evidenceFile.name : "No file chosen"}
              </span>
              <span className="shrink-0 bg-neutral-soft border border-border px-3 py-1 rounded text-xs font-semibold">
                Choose File
              </span>
            </button>
          </div>
          {activeHelpPath === "evidence.file" && renderHelpBox("evidence.file")}
        </div>
        <div>
          {renderFieldLabelWithTips("Document type", "evidence.documentType")}
          <input aria-label="Evidence document type" value={evidenceDocumentType} onChange={(event) => setEvidenceDocumentType(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" />
          {activeHelpPath === "evidence.documentType" && renderHelpBox("evidence.documentType")}
        </div>
        <div>
          {renderFieldLabelWithTips("Issuer", "evidence.issuer")}
          <input aria-label="Evidence issuer" value={evidenceIssuer} onChange={(event) => setEvidenceIssuer(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" />
          {activeHelpPath === "evidence.issuer" && renderHelpBox("evidence.issuer")}
        </div>
        <div>
          {renderFieldLabelWithTips("Issue date", "evidence.issueDate")}
          <input aria-label="Evidence issue date" type="date" value={evidenceIssueDate} onChange={(event) => setEvidenceIssueDate(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm" />
          {activeHelpPath === "evidence.issueDate" && renderHelpBox("evidence.issueDate")}
        </div>
        <div className="md:col-span-2">
          {renderFieldLabelWithTips("Linked input", "evidence.linkedInput")}
          <select aria-label="Evidence linked input" value={evidenceLinkedInput} onChange={(event) => setEvidenceLinkedInput(event.target.value)} className="w-full rounded border border-border bg-background p-2 text-sm">{EVIDENCE_LINK_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}{caseData.goods.flatMap((_, index) => [[`goods.${index}.cnCode`, `Good ${index + 1} CN code`], [`goods.${index}.productionVolume`, `Good ${index + 1} production`], [`goods.${index}.allocationShare`, `Good ${index + 1} allocation`]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}{caseData.precursors.flatMap((_, index) => [[`precursors.${index}.quantity`, `Precursor ${index + 1} quantity`], [`precursors.${index}.directEmissions`, `Precursor ${index + 1} direct emissions`], [`precursors.${index}.indirectEmissions`, `Precursor ${index + 1} indirect emissions`]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {activeHelpPath === "evidence.linkedInput" && renderHelpBox("evidence.linkedInput")}
        </div>
      </div><button type="button" onClick={handleEvidenceUpload} disabled={uploading} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Upload and register evidence</button><StatusBanner status={evidenceStatus} tone={evidenceStatus.toLowerCase().includes("failed") || evidenceStatus.includes("EVIDENCE_") ? "error" : "warning"} /></div>

      <div className="space-y-3">{caseData.evidenceRegister.map((evidence) => <div key={evidence.evidenceId} className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{evidence.fileName}</p><p className="text-xs text-muted">{evidence.documentType} · {evidence.sizeBytes} bytes · {evidence.reviewStatus}/{evidence.supportStatus}/{evidence.malwareScanStatus}</p><p className="mt-1 break-all font-mono text-[10px] text-muted">SHA-256 {evidence.fileHash}</p></div></div><div className="mt-3 flex flex-col gap-2 md:flex-row"><input aria-label={`Review notes for ${evidence.fileName}`} value={reviewNotes[evidence.evidenceId] || ""} onChange={(event) => setReviewNotes((previous) => ({ ...previous, [evidence.evidenceId]: event.target.value }))} placeholder="Internal review note" className="flex-1 rounded border border-border bg-background p-2 text-sm" /><button type="button" disabled={evidence.malwareScanStatus !== "CLEAN"} onClick={() => handleEvidenceReview(evidence.evidenceId, "APPROVED")} className="rounded bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Approve</button><button type="button" onClick={() => handleEvidenceReview(evidence.evidenceId, "REJECTED")} className="rounded bg-red-700 px-3 py-2 text-xs font-semibold text-white">Reject</button></div>{evidence.malwareScanStatus !== "CLEAN" && <p className="mt-2 text-xs text-amber-800">Approval is disabled until an administrator records an external malware scan as CLEAN.</p>}</div>)}</div>
    </div>
  );

  const renderStep8 = () => (
    <div className="space-y-6"><h2 className="text-xl font-bold">8. Verification readiness and dossier generation</h2><div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-surface p-6"><h3 className="mb-4 flex items-center gap-2 font-bold"><Shield className="h-5 w-5 text-accent" /> Verification readiness</h3><div className={`rounded border p-3 text-sm font-semibold ${readiness.isEligibleForSealing ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"}`}>{readiness.status} · {readiness.completenessPercentage}% · {readiness.passedControls}/{readiness.applicableControls} controls passed</div><div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{readiness.allGaps.map((gap) => <div key={gap.gapId} className="border-l-2 border-red-500 pl-3 text-xs"><strong>{gap.requirement}</strong><p className="text-muted">{gap.whyItMatters}</p></div>)}</div><button type="button" aria-label="Generate sealed dossier" onClick={handleSeal} disabled={sealing || !readiness.isEligibleForSealing || usableEntitlements.length === 0} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded bg-accent p-3 text-sm font-semibold text-surface disabled:cursor-not-allowed disabled:opacity-40">{sealing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Generate sealed dossier</button><StatusBanner status={sealStatus} tone="error" /><p className="mt-3 text-xs text-muted">Generation consumes a successful release only after server validation, immutable artifact commit and signature completion.</p></section>
      <section className="rounded-xl border border-border bg-surface p-6"><h3 className="mb-4 flex items-center gap-2 font-bold"><FileCode2 className="h-5 w-5 text-accent" /> Mathematical audit preview</h3>{calculation.error ? <StatusBanner status={calculation.error} tone="warning" /> : <><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted">Total embedded</span><strong className="block">{calculation.result?.totalEmbeddedEmissions} tCO2e</strong></div><div><span className="text-muted">Aggregate intensity</span><strong className="block">{calculation.result?.specificEmbeddedEmissions} tCO2e/t</strong></div><div><span className="text-muted">Allocation total</span><strong className="block">{calculation.result?.allocationShareTotal}</strong></div><div><span className="text-muted">Reconciliation delta</span><strong className="block">{calculation.result?.allocationReconciliationDelta}</strong></div></div><div className="mt-4 max-h-80 space-y-3 overflow-y-auto">{calculation.result?.trace.map((trace) => <div key={trace.calculationId} className="rounded border border-border bg-neutral-soft p-3 font-mono text-xs"><div className="font-bold text-accent">{trace.formulaId}</div><div>{String(trace.outputValue)} {trace.outputUnit}</div><div className="break-all text-[10px] text-muted">{trace.calculationHash}</div></div>)}</div></>}</section>
    </div></div>
  );

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7, renderStep8][currentStep - 1];

  return <main className="min-h-screen bg-background px-4 py-8 pb-32 text-foreground md:px-8"><div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-col justify-between gap-4 border-b border-border pb-4 md:flex-row md:items-center"><div><h1 className="text-2xl font-bold">Case workflow</h1><p className="text-sm text-muted">Reference Code: {getDisplayReferenceCode(caseData.caseId)} · User: {sessionUser.email || sessionUser.uid}</p></div><button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded border border-border bg-neutral-soft px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Saving…" : "Save draft"}</button></header><StatusBanner status={saveStatus} tone={saveTone} /><nav aria-label="Dossier steps" className="flex gap-3 overflow-x-auto pb-3">{STEPS.map((step) => <button type="button" key={step.id} onClick={() => setCurrentStep(step.id)} className={`min-w-28 rounded-lg border px-3 py-2 text-xs font-bold ${currentStep === step.id ? "border-accent bg-accent text-surface" : "border-border bg-surface text-muted"}`}><span className="block text-sm">{step.id}</span>{step.label}</button>)}</nav><section className="py-4">{stepContent()}</section></div><div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface p-4 shadow-[0_-4px_8px_rgba(0,0,0,0.08)]"><div className="mx-auto flex max-w-6xl items-center justify-between"><button type="button" onClick={() => setCurrentStep((step) => Math.max(1, step - 1))} disabled={currentStep === 1} className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Previous</button><span className="text-sm font-bold text-muted">Step {currentStep} of 8</span><button type="button" onClick={() => setCurrentStep((step) => Math.min(8, step + 1))} disabled={currentStep === 8} className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 text-surface disabled:opacity-40">Next <ArrowRight className="h-4 w-4" /></button></div></div></main>;
}
