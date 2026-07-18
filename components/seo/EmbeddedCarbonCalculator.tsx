"use client";

import { useState } from "react";
import { Calculator, CheckCircle, ShieldAlert } from "lucide-react";

interface CalculatorProps {
  defaultDirectFactor: number;
  defaultIndirectFactor: number;
  benchmarkTco2ePerTonne: number | null;
  sector: string;
  code: string;
}

export function EmbeddedCarbonCalculator({
  defaultDirectFactor,
  defaultIndirectFactor,
  benchmarkTco2ePerTonne,
  sector,
  code
}: CalculatorProps) {
  const [useDefault, setUseDefault] = useState(true);
  const [productionQty, setProductionQty] = useState<number>(1000);
  const [customDirect, setCustomDirect] = useState<number>(defaultDirectFactor);
  const [customIndirect, setCustomIndirect] = useState<number>(defaultIndirectFactor);
  const [carbonPrice, setCarbonPrice] = useState<number>(85); // 85 EUR per tonne average ETS

  // Calculations
  const directFactor = useDefault ? defaultDirectFactor : customDirect;
  const indirectFactor = useDefault ? defaultIndirectFactor : customIndirect;

  const directEmissions = productionQty * directFactor;
  const indirectEmissions = productionQty * indirectFactor;
  const totalEmissions = directEmissions + (sector === "electricity" ? 0 : indirectEmissions);
  
  // CBAM Liability Estimate (assuming no free allocation / transitional phase ending)
  const estimatedLiability = totalEmissions * carbonPrice;

  const unit = sector === "electricity" ? "MWh" : "tonnes";

  return (
    <section className="bg-surface border border-border rounded-2xl p-6 md:p-8 shadow-[var(--shadow-card)] mb-10 overflow-hidden relative">
      {/* Decorative Gradient Background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Header with IIT Bombay Validation Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-accent-soft p-2.5 rounded-lg text-accent">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">Interactive CBAM Liability Calculator</h3>
            <p className="text-xs text-muted">Estimate emissions and potential financial border tax liability</p>
          </div>
        </div>
        
        {/* Academic Validation Badge */}
        <div className="inline-flex items-center gap-1.5 bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-full text-xs font-semibold text-accent self-start sm:self-center">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>IIT Bombay Audited Methodology</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-5">
          {/* Default vs Custom Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-2">Calculation Mode</label>
            <div className="grid grid-cols-2 gap-2 bg-neutral-soft p-1 rounded-lg border border-border/30">
              <button
                type="button"
                onClick={() => setUseDefault(true)}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                  useDefault
                    ? "bg-surface text-accent shadow-sm border border-border/20"
                    : "text-muted hover:text-foreground"
                }`}
              >
                EU Default Values
              </button>
              <button
                type="button"
                onClick={() => setUseDefault(false)}
                className={`py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                  !useDefault
                    ? "bg-surface text-accent shadow-sm border border-border/20"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Actual Values (Custom)
              </button>
            </div>
          </div>

          {/* Production Volume */}
          <div>
            <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted mb-2">
              <span>Production Quantity</span>
              <span className="text-accent font-mono normal-case">{unit}</span>
            </label>
            <input
              type="number"
              value={productionQty}
              onChange={(e) => setProductionQty(Math.max(0, Number(e.target.value)))}
              className="w-full bg-neutral-soft border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-accent"
              placeholder="e.g. 1000"
            />
          </div>

          {/* Direct Emissions Intensity */}
          <div>
            <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted mb-2">
              <span>Direct Carbon Intensity</span>
              <span className="text-muted font-mono normal-case">tCO2e/t</span>
            </label>
            <input
              type="number"
              step="0.0001"
              value={directFactor}
              disabled={useDefault}
              onChange={(e) => setCustomDirect(Math.max(0, Number(e.target.value)))}
              className={`w-full bg-neutral-soft border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-accent ${
                useDefault ? "opacity-60 cursor-not-allowed bg-neutral-soft/50" : ""
              }`}
            />
          </div>

          {/* Indirect Emissions Intensity */}
          {sector !== "electricity" && (
            <div>
              <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted mb-2">
                <span>Indirect Carbon Intensity</span>
                <span className="text-muted font-mono normal-case">tCO2e/t</span>
              </label>
              <input
                type="number"
                step="0.0001"
                value={indirectFactor}
                disabled={useDefault}
                onChange={(e) => setCustomIndirect(Math.max(0, Number(e.target.value)))}
                className={`w-full bg-neutral-soft border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-accent ${
                  useDefault ? "opacity-60 cursor-not-allowed bg-neutral-soft/50" : ""
                }`}
              />
            </div>
          )}

          {/* EU ETS Carbon Price */}
          <div>
            <label className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted mb-2">
              <span>EU ETS Carbon Price</span>
              <span className="text-accent font-mono">€/tCO2e</span>
            </label>
            <input
              type="number"
              value={carbonPrice}
              onChange={(e) => setCarbonPrice(Math.max(0, Number(e.target.value)))}
              className="w-full bg-neutral-soft border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-foreground focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Outputs */}
        <div className="bg-neutral-soft/50 border border-border/40 rounded-xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted">Calculation Outcomes</h4>
            
            {/* Direct Emissions */}
            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-sm text-muted">Direct Emissions</span>
              <span className="font-mono text-sm font-bold text-foreground">
                {directEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e
              </span>
            </div>

            {/* Indirect Emissions */}
            {sector !== "electricity" && (
              <div className="flex justify-between items-center py-2 border-b border-border/30">
                <span className="text-sm text-muted">Indirect Emissions</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {indirectEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e
                </span>
              </div>
            )}

            {/* Total Emissions */}
            <div className="flex justify-between items-center py-2 border-b border-border/30">
              <span className="text-sm text-muted font-bold">Total Embedded Carbon</span>
              <span className="font-mono text-base font-extrabold text-accent">
                {totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO2e
              </span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/40 space-y-4">
            {/* CBAM Liability */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-muted mb-1">
                Estimated CBAM Tax Liability
              </span>
              <span className="block font-mono text-2xl md:text-3xl font-black text-foreground">
                €{estimatedLiability.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <p className="text-[10px] text-muted leading-relaxed mt-1">
                Based on current EU ETS carbon price modeling. Actual border tax surrenders depend on the difference between the EU price and carbon prices paid in the origin country.
              </p>
            </div>

            {/* Warning indicator */}
            {!useDefault && totalEmissions < (productionQty * (benchmarkTco2ePerTonne ?? defaultDirectFactor)) && (
              <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-[11px] text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>Optimized Case:</strong> Actual emissions are below the EU benchmark. Importers will reduce carbon certificate surrender obligations using your verified data.
                </span>
              </div>
            )}

            {!useDefault && totalEmissions >= (productionQty * (benchmarkTco2ePerTonne ?? defaultDirectFactor)) && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-[11px] text-amber-600 dark:text-amber-400">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  <strong>Above Benchmark:</strong> Actual emissions exceed EU default values. Importers should utilize EU default benchmarks to avoid excess costs where legally permitted.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
