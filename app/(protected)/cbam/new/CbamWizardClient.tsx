/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { Shield, CreditCard, CheckCircle2, ChevronRight, ChevronLeft, Loader2, CircleAlert, FileText, ShieldCheck, FileJson, FileCode2, Info, HelpCircle } from "lucide-react";
import { getSectorConfig, CbamSector } from "@/lib/cbam/sectors/sector-adapter";
import { assessCaseReadiness, EvidenceGapItem } from "@/lib/cbam/validation/readiness-assessor";

let paddleInstancePromise: Promise<Paddle | undefined> | null = null;

interface CbamWizardClientProps {
  sessionUser: {
    uid: string;
    email: string;
  };
  initialCase: any | null;
  availableEntitlements: any[];
}

function logConversionEvent(eventName: string, metadata?: any) {
  console.log(`[CONVERSION ANALYTICS] Event: ${eventName}`, metadata || {});
}

export default function CbamWizardClient({ sessionUser, initialCase, availableEntitlements }: CbamWizardClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(initialCase?.caseId || null);

  // 1. Company and Report Scope
  const [exporterName, setExporterName] = useState(initialCase?.data?.exporterName || "");
  const [declarantEORI, setDeclarantEORI] = useState(initialCase?.data?.declarantEORI || "");
  const [importYear, setImportYear] = useState(initialCase?.data?.importYear || 2026);
  const [importQuarter, setImportQuarter] = useState(initialCase?.data?.importQuarter || 1);
  const [role, setRole] = useState(initialCase?.data?.role || "IMPORTER");

  // 2. Products and Shipments
  const [cnCode, setCnCode] = useState(initialCase?.data?.cnCode || "");
  const [productionVolume, setProductionVolume] = useState(initialCase?.data?.productionVolume || 0);
  const [shipmentRecordsCount, setShipmentRecordsCount] = useState(initialCase?.data?.shipmentRecordsCount || 1);

  // 3. Installation and Production Route
  const [installationName, setInstallationName] = useState(initialCase?.data?.installationName || "");
  const [productionRoute, setProductionRoute] = useState(initialCase?.data?.productionRoute || "");

  // 4. Emissions and Precursors
  const [hasActualData, setHasActualData] = useState(initialCase?.data?.hasActualData || false);
  const [directEmissions, setDirectEmissions] = useState(initialCase?.data?.directEmissions || 0);
  const [electricityConsumed, setElectricityConsumed] = useState(initialCase?.data?.electricityConsumed || 0);
  const [gridEmissionFactor, setGridEmissionFactor] = useState(initialCase?.data?.gridEmissionFactor || 0.45);
  const [isComplexGood, setIsComplexGood] = useState(initialCase?.data?.isComplexGood || false);
  const [precursorDirectEmissions, setPrecursorDirectEmissions] = useState(initialCase?.data?.precursorDirectEmissions || 0);
  const [precursorIndirectEmissions, setPrecursorIndirectEmissions] = useState(initialCase?.data?.precursorIndirectEmissions || 0);

  // 5. Evidence and Verification
  const [carbonPricePaid, setCarbonPricePaid] = useState(initialCase?.data?.carbonPricePaid || 0);
  const [isVerified, setIsVerified] = useState(initialCase?.data?.isVerified || false);
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);

  // Sealing & Entitlements state
  const entitlements = availableEntitlements;
  const selectedEntitlementId = availableEntitlements[0]?.entitlementId || "";
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [paddleConfigError, setPaddleConfigError] = useState<string | null>(() => {
    if (typeof window !== "undefined" && !process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) {
      return "Paddle configuration is missing: NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not defined.";
    }
    return null;
  });
  const [paymentPending, setPaymentPending] = useState(false);
  const [sealedReport, setSealedReport] = useState<any | null>(null);

  // Active help overlay state
  const [activeHelpField, setActiveHelpField] = useState<string | null>(null);

  // Initialize analytics & Paddle
  useEffect(() => {
    logConversionEvent("report_started", { hasInitialCase: !!initialCase, email: sessionUser.email });
    
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      return;
    }

    if (!paddleInstancePromise) {
      paddleInstancePromise = initializePaddle({
        token,
        environment: process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" ? "sandbox" : "production",
      });
    }

    if (paddleInstancePromise) {
      paddleInstancePromise
        .then((instance) => {
          if (instance) {
            setPaddle(instance);
          }
        })
        .catch((err) => {
          console.error("Paddle initialization error:", err);
          setPaddleConfigError("Paddle initialization failed. Please check your configuration.");
        });
    }
  }, [initialCase, sessionUser.email]);

  // Compute sector based on CN Code
  let sector: CbamSector = "DOWNSTREAM_COMPLEX_GOODS";
  if (cnCode && cnCode.length >= 2) {
    const chapter = cnCode.substring(0, 2);
    if (["72", "73"].includes(chapter)) sector = "IRON_AND_STEEL";
    else if (chapter === "76") sector = "ALUMINIUM";
    else if (chapter === "25") sector = "CEMENT";
    else if (chapter === "31") sector = "FERTILISERS";
    else if (chapter === "28") sector = "HYDROGEN";
    else if (chapter === "27") sector = "ELECTRICITY";
  }
  const sectorConfig = getSectorConfig(sector);

  // Build current state payload
  const casePayload = {
    exporterName,
    declarantEORI,
    importYear: Number(importYear),
    importQuarter: Number(importQuarter),
    role,
    cnCode,
    productionVolume: Number(productionVolume),
    shipmentRecordsCount: Number(shipmentRecordsCount),
    installationName,
    productionRoute,
    hasActualData,
    directEmissions: Number(directEmissions),
    electricityConsumed: Number(electricityConsumed),
    gridEmissionFactor: Number(gridEmissionFactor),
    isComplexGood,
    precursorDirectEmissions: Number(precursorDirectEmissions),
    precursorIndirectEmissions: Number(precursorIndirectEmissions),
    carbonPricePaid: Number(carbonPricePaid),
    isVerified,
  };

  // Run validation readiness assessor
  const readiness = assessCaseReadiness(casePayload);

  // Save draft utility
  const saveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/cbam/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          data: casePayload,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setCaseId(data.caseId);
        logConversionEvent("draft_resumed", { caseId: data.caseId });
        return data.caseId;
      }
    } catch (e) {
      console.error("Draft save failed:", e);
    } finally {
      setSaving(false);
    }
    return null;
  };

  const handleNext = async () => {
    // Stage validations
    if (step === 1) {
      if (!exporterName) {
        alert("Please enter Exporter Legal Name.");
        return;
      }
      if (declarantEORI.length < 8 || declarantEORI.length > 17) {
        alert("Declarant EORI must be between 8 and 17 characters.");
        return;
      }
    } else if (step === 2) {
      if (cnCode.length !== 8) {
        alert("CN Code must be exactly 8 digits.");
        return;
      }
      if (productionVolume <= 0) {
        alert("Production volume must be greater than zero.");
        return;
      }
      logConversionEvent("sector_selected", { sector });
    } else if (step === 3) {
      if (!installationName) {
        alert("Installation profile name is required.");
        return;
      }
    }

    const draftId = await saveDraft();
    if (draftId) {
      logConversionEvent("step_completed", { step });
      setStep(step + 1);
      if (step === 5) {
        logConversionEvent("readiness_preview_viewed");
      }
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handlePurchase = async () => {
    if (!paddle || !caseId) {
      alert("Payment client is not active.");
      return;
    }
    setLoading(true);
    logConversionEvent("checkout_started", { caseId });
    try {
      const res = await fetch("/api/checkout/cbam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productCode: "CBAM_EXPORTER_FINAL_REPORT",
          caseId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }

      paddle.Checkout.open({
        transactionId: data.transactionId,
        settings: {
          displayMode: "overlay",
          theme: "dark",
        },
      });

      setPaymentPending(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSealReport = async () => {
    if (!caseId) return;
    if (!selectedEntitlementId && entitlements.length === 0) {
      alert("No available entitlement found. Please purchase first.");
      return;
    }
    setLoading(true);
    logConversionEvent("report_generation_started");
    try {
      const res = await fetch("/api/cbam/seal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          entitlementId: selectedEntitlementId || entitlements[0].entitlementId,
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setSealedReport(data.report);
        logConversionEvent("report_generation_completed", { reportId: data.report.reportId });
      } else {
        alert(data.error || "Sealing failed.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refreshEntitlements = async () => {
    setLoading(true);
    try {
      await fetch("/api/cbam/cases");
      router.refresh();
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Field Help content
  const fieldHelpData: Record<string, { definition: string; why: string; source: string; range: string; example: string }> = {
    exporterName: {
      definition: "The legal identity of the company exporting the CBAM-affected goods.",
      why: "Must match the commercial bill of lading and EU buyer invoices.",
      source: "Company legal registration statement.",
      range: "Valid corporate name.",
      example: "Global Smelting Corp Ltd",
    },
    declarantEORI: {
      definition: "Economic Operators Registration and Identification number.",
      why: "Used by customs to track importing entities in the EU customs system.",
      source: "EU Customs Tariff authorization dashboard.",
      range: "Alpha-numeric code (8 to 17 characters).",
      example: "GB123456789000",
    },
    cnCode: {
      definition: "8-digit Combined Nomenclature tariff code of the product.",
      why: "Determines the CBAM sector scope and benchmark default factors.",
      source: "Product specification sheets, export clearance documents.",
      range: "8 numeric characters subject to taxud applicability.",
      example: "72085120 (Flat-rolled iron/steel)",
    },
  };

  const toggleFieldHelp = (field: string) => {
    setActiveHelpField(activeHelpField === field ? null : field);
    logConversionEvent("field_help_opened", { field });
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8">
      <div className="max-w-4xl mx-auto bg-surface border border-border rounded-xl p-6 md:p-8 shadow-[var(--shadow-card)]">
        
        {/* Stage progress tracker */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4">
          {[
            "Scope",
            "Products",
            "Route",
            "Emissions",
            "Verification",
            "Preview"
          ].map((label, idx) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all border ${
                step === idx + 1
                  ? "border-accent bg-accent text-surface"
                  : step > idx + 1
                  ? "border-foreground bg-foreground text-surface"
                  : "border-border-strong bg-surface text-muted"
              }`}>
                {idx + 1}
              </span>
              <span className={`text-xs font-semibold whitespace-nowrap ${
                step === idx + 1 ? "text-foreground font-bold" : "text-muted"
              }`}>
                {label}
              </span>
              {idx < 5 && <span className="text-border text-xs">/</span>}
            </div>
          ))}
        </div>

        {/* STAGE 1 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">1. Company & Report Scope</h2>
              <p className="text-xs text-muted mt-1">Specify legal exporter profile and reporting duration boundaries.</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-foreground">Exporter Legal Name</label>
                  <button onClick={() => toggleFieldHelp("exporterName")} className="text-[10px] text-accent hover:underline font-semibold">Help</button>
                </div>
                <input
                  type="text"
                  value={exporterName}
                  onChange={(e) => setExporterName(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                  placeholder="e.g. Steel Exporters Ltd"
                />
                {activeHelpField === "exporterName" && (
                  <div className="mt-2 bg-neutral-soft border border-border p-4 rounded-lg text-xs space-y-2">
                    <div className="flex gap-3">
                      <HelpCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-foreground">Field Documentation</p>
                        <div className="mt-1.5 space-y-1.5 text-muted">
                          <p><strong>Definition:</strong> {fieldHelpData.exporterName.definition}</p>
                          <p><strong>Why Needed:</strong> {fieldHelpData.exporterName.why}</p>
                          <p><strong>Source:</strong> {fieldHelpData.exporterName.source}</p>
                          <p><strong>Example:</strong> {fieldHelpData.exporterName.example}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-foreground">Declarant EORI Reference</label>
                  <button onClick={() => toggleFieldHelp("declarantEORI")} className="text-[10px] text-accent hover:underline font-semibold">Help</button>
                </div>
                <input
                  type="text"
                  value={declarantEORI}
                  onChange={(e) => setDeclarantEORI(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                  placeholder="e.g. GB123456789000"
                />
                {activeHelpField === "declarantEORI" && (
                  <div className="mt-2 bg-neutral-soft border border-border p-4 rounded-lg text-xs space-y-2">
                    <div className="flex gap-3">
                      <HelpCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-foreground">Field Documentation</p>
                        <div className="mt-1.5 space-y-1.5 text-muted">
                          <p><strong>Definition:</strong> {fieldHelpData.declarantEORI.definition}</p>
                          <p><strong>Why Needed:</strong> {fieldHelpData.declarantEORI.why}</p>
                          <p><strong>Source:</strong> {fieldHelpData.declarantEORI.source}</p>
                          <p><strong>Example:</strong> {fieldHelpData.declarantEORI.example}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Reporting Year</label>
                  <select
                    value={importYear}
                    onChange={(e) => setImportYear(Number(e.target.value))}
                    className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                  >
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Quarter</label>
                  <select
                    value={importQuarter}
                    onChange={(e) => setImportQuarter(Number(e.target.value))}
                    className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                  >
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                    <option value={3}>Q3</option>
                    <option value={4}>Q4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Declarant Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                  >
                    <option value="IMPORTER">Importer</option>
                    <option value="OPERATOR">Operator</option>
                    <option value="INDIRECT_REP">Indirect Representative</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 2 */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">2. Products & Shipments</h2>
              <p className="text-xs text-muted mt-1">Specify custom codes, production volume limits, and shipment size count.</p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-foreground">CN Tariff Code (8 digits)</label>
                  <button onClick={() => toggleFieldHelp("cnCode")} className="text-[10px] text-accent hover:underline font-semibold">Help</button>
                </div>
                <input
                  type="text"
                  value={cnCode}
                  onChange={(e) => setCnCode(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                  placeholder="e.g. 72085120"
                />
                {activeHelpField === "cnCode" && (
                  <div className="mt-2 bg-neutral-soft border border-border p-4 rounded-lg text-xs space-y-2">
                    <div className="flex gap-3">
                      <HelpCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-foreground">Field Documentation</p>
                        <div className="mt-1.5 space-y-1.5 text-muted">
                          <p><strong>Definition:</strong> {fieldHelpData.cnCode.definition}</p>
                          <p><strong>Why Needed:</strong> {fieldHelpData.cnCode.why}</p>
                          <p><strong>Source:</strong> {fieldHelpData.cnCode.source}</p>
                          <p><strong>Example:</strong> {fieldHelpData.cnCode.example}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Total Production Volume ({sectorConfig.allowedUnits[0] === "MWh" ? "MWh" : "Tonnes"})
                  </label>
                  <input
                    type="number"
                    value={productionVolume}
                    onChange={(e) => setProductionVolume(Number(e.target.value))}
                    className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Shipment Records Count</label>
                  <input
                    type="number"
                    value={shipmentRecordsCount}
                    onChange={(e) => setShipmentRecordsCount(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 3 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">3. Installation & Production Route</h2>
              <p className="text-xs text-muted mt-1">Define factory profile characteristics and smelting boundaries.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Installation Facility Name</label>
                <input
                  type="text"
                  value={installationName}
                  onChange={(e) => setInstallationName(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                  placeholder="e.g. North Smelting Plant"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Production Route Technology</label>
                <select
                  value={productionRoute}
                  onChange={(e) => setProductionRoute(e.target.value)}
                  className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm"
                >
                  <option value="">-- Select Technology Route --</option>
                  {sectorConfig.allowedProductionRoutes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="bg-neutral-soft border border-border p-4 rounded-lg text-xs space-y-1.5 text-muted">
                <span className="font-bold text-foreground block mb-1">Sector System Boundaries:</span>
                <p>{sectorConfig.defaultBoundaries}</p>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 4 */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">4. Emissions & Precursors</h2>
              <p className="text-xs text-muted mt-1">Input direct process emissions, grid parameters, and precursor materials.</p>
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasActualData}
                  onChange={(e) => setHasActualData(e.target.checked)}
                  className="rounded accent-accent"
                />
                Use actual measured emissions data instead of EU default benchmark factors
              </label>

              {hasActualData && (
                <div className="grid grid-cols-3 gap-4 border border-border-strong p-4 rounded-xl bg-neutral-soft">
                  <div>
                    <label className="block text-[10px] font-bold text-muted mb-1">Direct Emissions (tCO2e)</label>
                    <input
                      type="number"
                      value={directEmissions}
                      onChange={(e) => setDirectEmissions(Number(e.target.value))}
                      className="w-full bg-surface border border-border-strong rounded-md p-2 text-xs text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted mb-1">Electricity (MWh)</label>
                    <input
                      type="number"
                      value={electricityConsumed}
                      onChange={(e) => setElectricityConsumed(Number(e.target.value))}
                      className="w-full bg-surface border border-border-strong rounded-md p-2 text-xs text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted mb-1">Grid factor (tCO2/MWh)</label>
                    <input
                      type="number"
                      value={gridEmissionFactor}
                      onChange={(e) => setGridEmissionFactor(Number(e.target.value))}
                      step={0.01}
                      className="w-full bg-surface border border-border-strong rounded-md p-2 text-xs text-foreground font-mono"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isComplexGood}
                  onChange={(e) => setIsComplexGood(e.target.checked)}
                  className="rounded accent-accent"
                />
                Product includes precursor inputs (Complex Downstream Goods)
              </label>

              {isComplexGood && (
                <div className="grid grid-cols-2 gap-4 border border-border-strong p-4 rounded-xl bg-neutral-soft">
                  <div>
                    <label className="block text-[10px] font-bold text-muted mb-1">Precursor Direct (tCO2e)</label>
                    <input
                      type="number"
                      value={precursorDirectEmissions}
                      onChange={(e) => setPrecursorDirectEmissions(Number(e.target.value))}
                      className="w-full bg-surface border border-border-strong rounded-md p-2 text-xs text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-muted mb-1">Precursor Indirect (tCO2e)</label>
                    <input
                      type="number"
                      value={precursorIndirectEmissions}
                      onChange={(e) => setPrecursorIndirectEmissions(Number(e.target.value))}
                      className="w-full bg-surface border border-border-strong rounded-md p-2 text-xs text-foreground font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STAGE 5 */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">5. Evidence & Verification</h2>
              <p className="text-xs text-muted mt-1">Add deductions for carbon price paid and declare verifier status.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Effective Carbon Price Paid (EUR/tCO2e)</label>
                <input
                  type="number"
                  value={carbonPricePaid}
                  onChange={(e) => setCarbonPricePaid(Number(e.target.value))}
                  className="w-full bg-surface border border-border-strong rounded-md px-3.5 py-2.5 text-foreground placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-4 focus:ring-[rgba(189,93,58,0.12)] text-sm font-mono"
                  placeholder="0.00"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                  className="rounded accent-accent"
                />
                Emissions verified by an accredited environmental audit body
              </label>

              <div className="flex gap-3 border border-border bg-accent-soft p-4 rounded-lg text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={liabilityAccepted}
                  onChange={(e) => setLiabilityAccepted(e.target.checked)}
                  className="rounded mt-0.5 accent-accent shadow-none focus:ring-0"
                />
                <div>
                  <p className="font-semibold text-foreground">Dossier Limitation Agreement</p>
                  <p className="mt-1 text-muted leading-relaxed">
                    I accept that CBAMValid is an independent evidence organization providing data compilation support, and is not an official EU Customs Authority or accredited verifier.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STAGE 6 - REVIEW, PREPAYMENT VALUE PREVIEW & DELIVERY */}
        {step === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold">6. Review, Payment & Delivery</h2>
              <p className="text-xs text-muted mt-1">Review prepayment readiness, process checkout, and download sealed reports.</p>
            </div>

            {/* PREPAYMENT VALUE PREVIEW */}
            <div className="bg-surface border border-border rounded-xl p-5 space-y-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Your CBAM Report Is Ready</h3>
                <span className="text-xs font-bold bg-accent-soft text-accent px-2.5 py-1 rounded font-mono">USD 150.00</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted block">Installation:</span>
                  <span className="font-semibold text-foreground">{installationName || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted block">Reporting period:</span>
                  <span className="font-semibold text-foreground">{importYear} Q{importQuarter}</span>
                </div>
                <div>
                  <span className="text-muted block">Products assessed:</span>
                  <span className="font-semibold text-foreground font-mono">1 (CN: {cnCode})</span>
                </div>
                <div>
                  <span className="text-muted block">Shipment records:</span>
                  <span className="font-semibold text-foreground font-mono">{shipmentRecordsCount} items</span>
                </div>
                <div>
                  <span className="text-muted block">Data completeness:</span>
                  <span className="font-semibold text-foreground font-mono">{readiness.dataCompletenessPercentage}%</span>
                </div>
                <div>
                  <span className="text-muted block">Verification status:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {isVerified ? "Verified actual data" : hasActualData ? "Unverified actual data" : "Official default values used"}
                  </span>
                </div>
              </div>
            </div>

            {/* VALUE TRANSLATION DISPLAY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="border border-border p-3 rounded-lg bg-neutral-soft">
                <span className="text-xs font-bold text-accent block mb-0.5">Regulatory snapshot</span>
                <p className="text-[10px] text-muted">See exactly which official rules and weekly certificate pricing versions were utilized.</p>
              </div>
              <div className="border border-border p-3 rounded-lg bg-neutral-soft">
                <span className="text-xs font-bold text-accent block mb-0.5">Calculation trace</span>
                <p className="text-[10px] text-muted">Show your EU buyer or auditor how every single calculation result was deterministic.</p>
              </div>
              <div className="border border-border p-3 rounded-lg bg-neutral-soft">
                <span className="text-xs font-bold text-accent block mb-0.5">Evidence index</span>
                <p className="text-[10px] text-muted">Map and link uploaded declarations directly to mathematical carbon metrics.</p>
              </div>
              <div className="border border-border p-3 rounded-lg bg-neutral-soft">
                <span className="text-xs font-bold text-accent block mb-0.5">Document hash seal</span>
                <p className="text-[10px] text-muted">Provide immutable validation to confirm your delivered dossier has not been modified.</p>
              </div>
            </div>

            {/* FREE READINESS & EVIDENCE-GAP CHECKLIST */}
            <div className="border border-border rounded-xl p-5 space-y-4 bg-surface shadow-[var(--shadow-card)]">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <CircleAlert className="h-4 w-4 text-accent" strokeWidth={1.75} />
                Evidence & Data Completeness Check
              </h3>

              <div className="space-y-3">
                {readiness.gapAnalysis.map((gap: EvidenceGapItem) => (
                  <div key={gap.itemName} className="border-l-2 border-accent bg-accent-soft/20 pl-3.5 py-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{gap.itemName}</span>
                      <span className="text-[9px] bg-accent-soft text-accent px-1.5 py-0.5 rounded font-bold font-mono">{gap.severity}</span>
                    </div>
                    <p className="text-muted mt-1">{gap.whyItMatters}</p>
                    <p className="text-[10px] text-subtle mt-0.5">Source: {gap.whereToObtain}</p>
                  </div>
                ))}
                {readiness.gapAnalysis.length === 0 && (
                  <p className="text-xs text-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-foreground" strokeWidth={1.75} /> All critical fields and evidence attachments satisfied.
                  </p>
                )}
              </div>
            </div>

            {/* FULFILLMENT TRIGGERS */}
            <div className="border-t border-border pt-6 space-y-4">
              {entitlements.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted">
                    A USD 150.00 single payment purchase is required to unlock sealing. You currently have 0 entitlements.
                  </p>
                  {paddleConfigError && (
                    <div className="p-3 border border-border bg-accent-soft text-accent text-xs font-mono text-center rounded-md">
                      {paddleConfigError}
                    </div>
                  )}
                  <button
                    onClick={handlePurchase}
                    disabled={loading || readiness.status === "BLOCKED" || !paddle || !!paddleConfigError}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                  >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                    Pay USD 150 & Generate Report
                  </button>
                  {paymentPending && (
                    <button
                      onClick={refreshEntitlements}
                      className="w-full text-xs text-accent hover:underline text-center block mt-2 font-semibold"
                    >
                      Completed checkout? Click here to refresh entitlements.
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-accent-soft border border-accent/20 p-3 rounded-lg text-xs text-foreground font-semibold flex items-center gap-2">
                    <Info size={16} className="text-accent shrink-0" strokeWidth={1.75} />
                    <span><strong>1 Entitlement Available:</strong> You are ready to seal this CBAM Exporter Final Evidence report.</span>
                  </div>
                  {!sealedReport ? (
                    <button
                      onClick={handleSealReport}
                      disabled={loading || !liabilityAccepted}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Shield className="h-5 w-5" />}
                      Seal Definitive Dossier
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3 shadow-[var(--shadow-card)]">
                        <ShieldCheck className="h-6 w-6 shrink-0 text-accent" strokeWidth={1.75} />
                        <div>
                          <p className="font-bold text-sm text-foreground">Dossier Successfully Sealed!</p>
                          <p className="text-[10px] text-muted font-mono">SHA-256 Seal: {sealedReport.documentHash}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <a
                          href={`/api/cbam/reports/${sealedReport.reportId}/download?format=pdf`}
                          onClick={() => logConversionEvent("pdf_downloaded")}
                          className="bg-surface border border-border p-3.5 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 hover:bg-neutral-soft text-foreground shadow-[var(--shadow-card)]"
                        >
                          <FileText className="h-5 w-5 text-accent" strokeWidth={1.75} />
                          <span className="text-xs font-bold">PDF Dossier</span>
                        </a>
                        <a
                          href={`/api/cbam/reports/${sealedReport.reportId}/download?format=json`}
                          onClick={() => logConversionEvent("json_downloaded")}
                          className="bg-surface border border-border p-3.5 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 hover:bg-neutral-soft text-foreground shadow-[var(--shadow-card)]"
                        >
                          <FileJson className="h-5 w-5 text-accent" strokeWidth={1.75} />
                          <span className="text-xs font-bold">JSON Data</span>
                        </a>
                        <a
                          href={`/api/cbam/reports/${sealedReport.reportId}/download?format=xml`}
                          onClick={() => logConversionEvent("xml_downloaded")}
                          className="bg-surface border border-border p-3.5 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 hover:bg-neutral-soft text-foreground shadow-[var(--shadow-card)]"
                        >
                          <FileCode2 className="h-5 w-5 text-accent" strokeWidth={1.75} />
                          <span className="text-xs font-bold">XML Evidence</span>
                        </a>
                      </div>

                      <a
                        href={`/api/verify/${sealedReport.documentHash}`}
                        onClick={() => logConversionEvent("verification_page_opened")}
                        className="block text-center text-xs text-accent hover:underline font-semibold mt-2"
                      >
                        Public Sealing verification page
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Controls footer */}
        {step < 6 && (
          <div className="flex items-center justify-between border-t border-border pt-6 mt-8">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="inline-flex items-center gap-1 border border-border-strong bg-transparent px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-soft cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed rounded-md"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-5 py-2 text-xs font-semibold text-surface transition-colors hover:bg-accent-hover active:bg-accent-active cursor-pointer disabled:opacity-40"
            >
              {saving ? "Saving..." : "Next"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
