/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { Shield, CreditCard, CheckCircle2, CircleAlert, HelpCircle, FileText, UploadCloud, FileCheck, FileCode2, ArrowRight, ArrowLeft } from "lucide-react";
import { assessCaseReadiness } from "@/lib/cbam/validation/readiness-assessor";
import { performDossierCalculations } from "@/lib/cbam/calculator";
import { AuditReadyCase, createEmptyInput } from "@/lib/cbam/schema";
import { saveCase, sealReport } from "@/lib/functions/client";

// Compliance check declaration
const fieldHelpData = {};

let paddleInstancePromise: Promise<Paddle | undefined> | null = null;

interface CaseWizardClientProps {
  sessionUser: {
    uid: string;
    email: string;
  };
  initialCase: AuditReadyCase;
  availableEntitlements: any[];
}

const STEPS = [
  { id: 1, label: "Case Setup" },
  { id: 2, label: "Products" },
  { id: 3, label: "Installation" },
  { id: 4, label: "Direct Emissions" },
  { id: 5, label: "Indirect Emissions" },
  { id: 6, label: "Precursors" },
  { id: 7, label: "Carbon Price" },
  { id: 8, label: "Verification & Seal" },
];

export default function CaseWizardClient({ sessionUser, initialCase, availableEntitlements }: CaseWizardClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [paddle, setPaddle] = useState<Paddle | null>(null);

  const [caseData, setCaseData] = useState<AuditReadyCase>(initialCase);

  const readiness = assessCaseReadiness(caseData);
  const calculationOutput = performDossierCalculations(caseData);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (token && !paddleInstancePromise) {
      paddleInstancePromise = initializePaddle({
        token,
        environment: process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" ? "sandbox" : "production",
      });
    }
    if (paddleInstancePromise) {
      paddleInstancePromise.then((instance) => {
        if (instance) setPaddle(instance);
      }).catch(console.error);
    }
  }, []);

  const handleUpdateInputDatum = (path: string, val: string | number | null) => {
    setCaseData((prev: any) => {
      const next = { ...prev };
      const dot = ".";
      const parts = path.split(dot);
      let current = next;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      if (!current[parts[parts.length - 1]]) {
        current[parts[parts.length - 1]] = createEmptyInput();
      }
      current[parts[parts.length - 1]].value = val;
      return next;
    });
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      await saveCase(caseData, caseData.caseId);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < 8) setCurrentStep(c => c + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(c => c - 1);
  };

  // UI Renderers per step
  const renderStep1 = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">1. Case Setup (Identity & Scope)</h2>
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-foreground">Exporter Legal Name</label>
          <input 
            type="text" 
            value={(caseData.exporterIdentity.legalName.value as string) || ""} 
            onChange={e => handleUpdateInputDatum("exporterIdentity.legalName", e.target.value)}
            className="w-full bg-background border border-border rounded p-2 text-sm mt-1" 
          />
        </div>
        <div>
          <label className="text-xs font-bold text-foreground">Declarant EORI Number</label>
          <input 
            type="text" 
            value={(caseData.importerIdentity.eoriNumber.value as string) || ""} 
            onChange={e => handleUpdateInputDatum("importerIdentity.eoriNumber", e.target.value)}
            className="w-full bg-background border border-border rounded p-2 text-sm mt-1" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">2. Products & Goods</h2>
      <div className="bg-surface border border-border rounded-xl p-6">
        {caseData.goods.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded">
            <p className="text-sm text-muted">No goods declared. Add an imported good (e.g., CN Code).</p>
            <button 
              onClick={() => {
                const newGood = { cnCode: createEmptyInput(), sector: "GENERAL", productionVolume: createEmptyInput(), shipmentRecords: createEmptyInput() };
                setCaseData(prev => ({ ...prev, goods: [...prev.goods, newGood] }));
              }}
              className="mt-4 px-4 py-2 bg-neutral-soft border border-border rounded text-sm hover:bg-border transition-colors"
            >
              Add Product
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {caseData.goods.map((good, idx) => (
              <div key={idx} className="p-4 border border-border rounded">
                <label className="text-xs font-bold">CN Code</label>
                <input 
                  type="text" 
                  value={(good.cnCode.value as string) || ""} 
                  onChange={e => {
                    const newGoods = [...caseData.goods];
                    newGoods[idx].cnCode.value = e.target.value;
                    setCaseData(prev => ({...prev, goods: newGoods}));
                  }}
                  className="w-full bg-background border border-border rounded p-2 text-sm mt-1 mb-3" 
                />
                <label className="text-xs font-bold">Production Volume (tonnes)</label>
                <input 
                  type="number" 
                  value={(good.productionVolume.value as string) || ""} 
                  onChange={e => {
                    const newGoods = [...caseData.goods];
                    newGoods[idx].productionVolume.value = e.target.value;
                    setCaseData(prev => ({...prev, goods: newGoods}));
                  }}
                  className="w-full bg-background border border-border rounded p-2 text-sm mt-1" 
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">3. Installation Boundaries</h2>
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-foreground">Facility Name</label>
          <input 
            type="text" 
            value={(caseData.installation.name.value as string) || ""} 
            onChange={e => handleUpdateInputDatum("installation.name", e.target.value)}
            className="w-full bg-background border border-border rounded p-2 text-sm mt-1" 
          />
        </div>
        <div>
          <label className="text-xs font-bold text-foreground">Production Route</label>
          <input 
            type="text" 
            value={(caseData.installation.productionRoute.value as string) || ""} 
            onChange={e => handleUpdateInputDatum("installation.productionRoute", e.target.value)}
            className="w-full bg-background border border-border rounded p-2 text-sm mt-1" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">4. Direct Emissions</h2>
      <div className="bg-surface border border-border rounded-xl p-6">
        <label className="text-xs font-bold text-foreground">Total Direct Emissions (tCO2e)</label>
        <input 
          type="number" 
          value={(caseData.directEmissions.value as string) || ""} 
          onChange={e => handleUpdateInputDatum("directEmissions", e.target.value)}
          className="w-full bg-background border border-border rounded p-2 text-sm mt-1" 
        />
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">5. Indirect Emissions</h2>
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="text-xs font-bold text-foreground">Electricity Consumed (MWh)</label>
          <input 
            type="number" 
            value={(caseData.electricityConsumed.value as string) || ""} 
            onChange={e => handleUpdateInputDatum("electricityConsumed", e.target.value)}
            className="w-full bg-background border border-border rounded p-2 text-sm mt-1" 
          />
        </div>
        <div>
          <label className="text-xs font-bold text-foreground">Grid Emission Factor (tCO2e/MWh)</label>
          <input 
            type="number" 
            value={(caseData.gridEmissionFactor.value as string) || ""} 
            onChange={e => handleUpdateInputDatum("gridEmissionFactor", e.target.value)}
            className="w-full bg-background border border-border rounded p-2 text-sm mt-1" 
          />
        </div>
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">6. Precursor Emissions</h2>
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="text-center py-6 border border-dashed border-border rounded">
          <p className="text-sm text-muted">No precursors defined.</p>
        </div>
      </div>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold">7. Carbon Price Paid</h2>
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="text-center py-6 border border-dashed border-border rounded">
          <p className="text-sm text-muted">No carbon price records attached.</p>
        </div>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">8. Verification & Seal</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Verification Readiness */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Verification Readiness
          </h2>
          <div className="space-y-3">
            <div className={`p-3 rounded border text-sm font-semibold ${readiness.isEligibleForSealing ? 'bg-accent/10 text-accent border-accent/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              Status: {readiness.status} ({readiness.completenessPercentage}% Complete)
            </div>
            {readiness.criticalBlockers.length > 0 && (
              <div className="mt-4">
                <p className="font-bold text-red-500 text-sm mb-2">Blockers preventing sealing:</p>
                {readiness.criticalBlockers.map(g => (
                  <div key={g.requirement} className="border-l-2 border-red-500 pl-3 py-1 text-xs mb-2">
                    <span className="font-bold">{g.requirement}</span>
                    <p className="text-muted">{g.whyItMatters}</p>
                  </div>
                ))}
              </div>
            )}
            {readiness.isEligibleForSealing && (
               <button 
               disabled={!readiness.isEligibleForSealing}
               className="w-full mt-4 p-3 border border-border rounded bg-accent text-surface hover:bg-accent-hover text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               Seal Report & Generate Dossier →
             </button>
            )}
          </div>
        </div>

        {/* Calculation Trace */}
        <div className="bg-surface border border-border rounded-xl p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-accent" />
            Mathematical Audit Trace
          </h2>
          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {calculationOutput.trace.map(node => {
              const isNotCalculated = node.outputValue === "NOT_CALCULATED";
              return (
                <div key={node.calculationId} className={`p-4 border rounded font-mono text-xs space-y-2 ${isNotCalculated ? 'bg-red-500/5 border-red-500/30' : 'bg-neutral-soft border-border'}`}>
                  <div className="flex justify-between border-b border-border pb-2">
                    <span className={`font-bold ${isNotCalculated ? 'text-red-500' : 'text-accent'}`}>{node.formulaId}</span>
                    <span className="text-muted">{node.calculationHash.substring(0,8)}</span>
                  </div>
                  <div>
                    <strong>Inputs:</strong>
                    <pre className="mt-1 text-[10px] whitespace-pre-wrap">{JSON.stringify(node.inputs, null, 2)}</pre>
                  </div>
                  {isNotCalculated && (
                    <p className="text-red-500 font-bold mt-1">WARNING: {node.warnings[0]}</p>
                  )}
                  <p className={`text-right font-bold mt-2 pt-2 border-t ${isNotCalculated ? 'border-red-500/30 text-red-500' : 'border-border text-foreground'}`}>
                    = {node.outputValue} {node.outputUnit}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 md:px-8 pb-32">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header / Top Bar */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold">Case Workflow</h1>
            <p className="text-sm text-muted">ID: {caseData.caseId || "DRAFT"}</p>
          </div>
          <button 
            onClick={saveDraft}
            disabled={saving}
            className="text-sm font-medium bg-neutral-soft border border-border px-4 py-2 rounded hover:bg-border transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>

        {/* 8-Step Stepper UI */}
        <div className="flex items-center justify-between overflow-x-auto pb-4">
          {STEPS.map((step) => (
            <div 
              key={step.id} 
              onClick={() => setCurrentStep(step.id)}
              className={`flex flex-col items-center cursor-pointer min-w-[100px] transition-opacity ${currentStep === step.id ? 'opacity-100' : 'opacity-50 hover:opacity-100'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 mb-2 ${
                currentStep === step.id 
                  ? 'border-accent bg-accent text-surface' 
                  : (step.id < currentStep ? 'border-accent text-accent' : 'border-border text-muted')
              }`}>
                {step.id}
              </div>
              <span className={`text-[10px] uppercase font-bold text-center ${currentStep === step.id ? 'text-accent' : 'text-muted'}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <div className="py-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
          {currentStep === 5 && renderStep5()}
          {currentStep === 6 && renderStep6()}
          {currentStep === 7 && renderStep7()}
          {currentStep === 8 && renderStep8()}
        </div>

        {/* Bottom Navigation Controls */}
        <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button 
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-soft border border-border rounded hover:bg-border transition-colors disabled:opacity-50"
            >
              <ArrowLeft size={16} /> Previous
            </button>
            <div className="text-sm font-bold text-muted">
              Step {currentStep} of 8
            </div>
            <button 
              onClick={handleNext}
              disabled={currentStep === 8}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-surface rounded hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              Next <ArrowRight size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
