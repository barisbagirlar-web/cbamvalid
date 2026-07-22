"use client";

import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  BarChart3, 
  FileText, 
  HelpCircle,
  AlertTriangle,
  Info
} from "lucide-react";

type CurrencyCode = "USD" | "EUR" | "TRY" | "GBP";

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  TRY: "₺",
  GBP: "£",
};

export default function CompanyValuationCalculator() {
  // 1. Inputs State
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [wacc, setWacc] = useState<number>(10.5); // %
  const [growthRate, setGrowthRate] = useState<number>(2.0); // %
  const [ebitda, setEbitda] = useState<number>(5000000); // Currency amount
  const [multiple, setMultiple] = useState<number>(8.5); // EBITDA Multiple
  const [debt, setDebt] = useState<number>(12000000); // Total Debt
  const [cash, setCash] = useState<number>(3000000); // Cash
  
  // FCF Forecast (Years 1 to 5)
  const [fcf1, setFcf1] = useState<number>(4000000);
  const [fcf2, setFcf2] = useState<number>(4500000);
  const [fcf3, setFcf3] = useState<number>(5100000);
  const [fcf4, setFcf4] = useState<number>(5800000);
  const [fcf5, setFcf5] = useState<number>(6500000);

  // Active Tooltip Info State
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // 2. Calculations (Pure deterministic logic)
  const valuation = useMemo(() => {
    const symbol = CURRENCY_SYMBOLS[currency];
    const r = wacc / 100;
    
    // Gordon Growth Model safety guard: growth rate cannot be >= WACC
    let safeG = growthRate;
    let isGrowthCapped = false;
    if (growthRate >= wacc) {
      safeG = Number((wacc - 0.5).toFixed(2));
      isGrowthCapped = true;
    }
    const g = safeG / 100;

    // 2.1 DCF Method
    // Present Value of Forecasted Cash Flows
    const discountFactors = [
      1 / Math.pow(1 + r, 1),
      1 / Math.pow(1 + r, 2),
      1 / Math.pow(1 + r, 3),
      1 / Math.pow(1 + r, 4),
      1 / Math.pow(1 + r, 5)
    ];
    
    const fcfValues = [fcf1, fcf2, fcf3, fcf4, fcf5];
    const pvForecast = fcfValues.reduce((sum, fcf, index) => sum + fcf * discountFactors[index], 0);

    // Terminal Value calculation
    // TV = (FCF5 * (1 + g)) / (r - g)
    const terminalValue = (fcf5 * (1 + g)) / (r - g);
    const pvTerminalValue = terminalValue * discountFactors[4]; // Discounted back 5 years

    // DCF Enterprise Value
    const dcfEnterpriseValue = pvForecast + pvTerminalValue;

    // 2.2 EBITDA Multiple Method
    const multipleEnterpriseValue = ebitda * multiple;

    // Net Debt Calculation
    const netDebt = debt - cash;

    // DCF Equity Value (locked to 0 if negative - limited liability rule)
    const dcfEquityValue = Math.max(0, dcfEnterpriseValue - netDebt);
    const isDcfEquityNegative = (dcfEnterpriseValue - netDebt) < 0;

    // EBITDA Equity Value
    const multipleEquityValue = Math.max(0, multipleEnterpriseValue - netDebt);
    const isMultipleEquityNegative = (multipleEnterpriseValue - netDebt) < 0;

    // 2.3 Blended Valuation (50% DCF / 50% Multiple)
    const blendedEnterpriseValue = (dcfEnterpriseValue + multipleEnterpriseValue) / 2;
    const blendedEquityValue = Math.max(0, blendedEnterpriseValue - netDebt);
    const isBlendedEquityNegative = (blendedEnterpriseValue - netDebt) < 0;

    return {
      symbol,
      safeG,
      isGrowthCapped,
      pvForecast,
      terminalValue,
      pvTerminalValue,
      dcfEnterpriseValue,
      multipleEnterpriseValue,
      netDebt,
      dcfEquityValue,
      isDcfEquityNegative,
      multipleEquityValue,
      isMultipleEquityNegative,
      blendedEnterpriseValue,
      blendedEquityValue,
      isBlendedEquityNegative
    };
  }, [currency, wacc, growthRate, ebitda, multiple, debt, cash, fcf1, fcf2, fcf3, fcf4, fcf5]);

  // Formatting Helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 0
    }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 font-sans text-foreground bg-background print:bg-white print:text-black">
      
      {/* Print-Only Corporate Header */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-8">
        <h1 className="text-3xl font-serif font-bold text-slate-900">CBAMValid Financial Engines</h1>
        <p className="text-sm text-slate-500 uppercase tracking-wider">Professional Company Valuation Report • Free Valuation Tool</p>
        <div className="mt-2 text-xs text-slate-600 flex justify-between">
          <span>Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
          <span>Engine Version: VALUATION-CORE-1.0</span>
        </div>
      </div>

      {/* Calculator Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-border pb-6 mb-8 print:hidden">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-accent-soft text-accent text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> Niche Financial Tools
          </div>
          <h2 className="text-3xl font-bold font-serif tracking-tight">
            Şirket Değeri Hesaplama <span className="text-muted font-normal text-2xl">/ Company Valuation</span>
          </h2>
          <p className="text-muted text-sm mt-1">
            Calculate Equity Value using Discounted Cash Flows (DCF) and EBITDA multiples. 100% Free.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-muted">Currency:</label>
          <select 
            aria-label="Select currency"
            value={currency} 
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="rounded border border-border bg-background p-2 text-sm font-semibold font-mono"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="TRY">TRY (₺)</option>
            <option value="GBP">GBP (£)</option>
          </select>
          <button 
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover transition-colors shadow-sm cursor-pointer"
          >
            <FileText className="w-4 h-4" /> Print Valuation Report
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Inputs (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6 print:hidden">
          
          {/* Section 1: DCF Assumptions */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-5 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 text-foreground border-b border-border/60 pb-2">
              <Percent className="w-5 h-5 text-accent" /> 1. DCF Valuation Inputs
            </h3>

            {/* FCF Forecast Group */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  Projected Free Cash Flows (FCF)
                  <HelpCircle 
                    className="w-4 h-4 text-muted cursor-pointer hover:text-foreground" 
                    onClick={() => setActiveTooltip(activeTooltip === "fcf" ? null : "fcf")}
                  />
                </span>
              </div>
              
              {activeTooltip === "fcf" && (
                <div className="rounded-lg bg-accent-soft p-3 text-xs text-accent-strong border border-accent/20 leading-relaxed">
                  Free Cash Flow represents the cash generated after capital expenditures. Input your expectations for the next 5 years.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {[
                  { label: "Year 1", val: fcf1, set: setFcf1 },
                  { label: "Year 2", val: fcf2, set: setFcf2 },
                  { label: "Year 3", val: fcf3, set: setFcf3 },
                  { label: "Year 4", val: fcf4, set: setFcf4 },
                  { label: "Year 5", val: fcf5, set: setFcf5 },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted uppercase">{item.label}</label>
                    <input 
                      aria-label={`FCF ${item.label}`}
                      type="number"
                      value={item.val}
                      onChange={(e) => item.set(Math.max(0, Number(e.target.value)))}
                      className="w-full rounded border border-border bg-background p-1.5 text-xs font-mono font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* WACC & Growth Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* WACC Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    WACC (Discount Rate)
                    <HelpCircle 
                      className="w-3.5 h-3.5 text-muted cursor-pointer hover:text-foreground"
                      onClick={() => setActiveTooltip(activeTooltip === "wacc" ? null : "wacc")}
                    />
                  </span>
                  <span className="font-bold font-mono text-accent">{wacc}%</span>
                </div>
                {activeTooltip === "wacc" && (
                  <div className="rounded bg-accent-soft p-2 text-xs text-accent-strong border border-accent/20 leading-normal mb-2">
                    Weighted Average Cost of Capital is the minimum return required to satisfy investors and creditors.
                  </div>
                )}
                <input 
                  aria-label="WACC percentage"
                  type="range" 
                  min="4" 
                  max="25" 
                  step="0.1" 
                  value={wacc} 
                  onChange={(e) => setWacc(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

              {/* Terminal Growth Rate Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-muted flex items-center gap-1">
                    Terminal Growth Rate (g)
                    <HelpCircle 
                      className="w-3.5 h-3.5 text-muted cursor-pointer hover:text-foreground"
                      onClick={() => setActiveTooltip(activeTooltip === "g" ? null : "g")}
                    />
                  </span>
                  <span className="font-bold font-mono text-accent">{growthRate}%</span>
                </div>
                {activeTooltip === "g" && (
                  <div className="rounded bg-accent-soft p-2 text-xs text-accent-strong border border-accent/20 leading-normal mb-2">
                    The constant growth rate a company is expected to sustain in perpetuity (typically inline with long-term inflation).
                  </div>
                )}
                <input 
                  aria-label="Terminal growth rate percentage"
                  type="range" 
                  min="0.5" 
                  max="10" 
                  step="0.1" 
                  value={growthRate} 
                  onChange={(e) => setGrowthRate(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>

            </div>

            {/* Growth Rate Guard Alert */}
            {valuation.isGrowthCapped && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 leading-normal">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Gordon Growth safety guard active:</strong> Terminal Growth Rate cannot be greater than or equal to WACC. Capped to {valuation.safeG}% to prevent mathematical discontinuity.
                </div>
              </div>
            )}

          </div>

          {/* Section 2: EBITDA Multiple assumptions */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 text-foreground border-b border-border/60 pb-2">
              <BarChart3 className="w-5 h-5 text-accent" /> 2. Multiple Valuation Inputs
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted uppercase">Annual EBITDA</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-xs font-bold text-muted font-mono">{valuation.symbol}</span>
                  <input 
                    aria-label="Annual EBITDA amount"
                    type="number"
                    value={ebitda}
                    onChange={(e) => setEbitda(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-border bg-background py-1.5 pl-7 pr-3 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-muted uppercase">
                  <span>EBITDA Multiple</span>
                  <span className="font-bold font-mono text-accent">{multiple}x</span>
                </div>
                <input 
                  aria-label="EBITDA multiple value"
                  type="range"
                  min="3"
                  max="20"
                  step="0.1"
                  value={multiple}
                  onChange={(e) => setMultiple(Number(e.target.value))}
                  className="w-full mt-3.5 accent-accent"
                />
              </div>
            </div>

          </div>

          {/* Section 3: Balance sheet Net Debt inputs */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 text-foreground border-b border-border/60 pb-2">
              <DollarSign className="w-5 h-5 text-accent" /> 3. Net Debt Adjustments
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted uppercase">Total Debt</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-xs font-bold text-muted font-mono">{valuation.symbol}</span>
                  <input 
                    aria-label="Total debt amount"
                    type="number"
                    value={debt}
                    onChange={(e) => setDebt(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-border bg-background py-1.5 pl-7 pr-3 text-sm font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted uppercase">Cash & Cash Equivalents</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2 text-xs font-bold text-muted font-mono">{valuation.symbol}</span>
                  <input 
                    aria-label="Cash and cash equivalents amount"
                    type="number"
                    value={cash}
                    onChange={(e) => setCash(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded border border-border bg-background py-1.5 pl-7 pr-3 text-sm font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center rounded-lg bg-surface border border-border p-3 text-xs font-semibold font-mono">
              <span className="text-muted">Calculated Net Debt:</span>
              <span className="text-foreground">{formatCurrency(valuation.netDebt)}</span>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Outputs and Chart (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6 print:w-full">
          
          {/* Card: Blended Valuation */}
          <div className="rounded-xl border-2 border-accent bg-surface p-6 space-y-4 shadow-md print:border-slate-800">
            <h3 className="text-md font-bold uppercase tracking-wider text-accent text-center border-b border-border/80 pb-2 print:text-slate-900">
              Blended Valuation (Equity Value)
            </h3>
            
            <div className="text-center py-2">
              <div className="text-[11px] font-semibold text-muted uppercase">Weighted Average (50/50)</div>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-foreground tracking-tight mt-1 print:text-slate-900">
                {formatCurrency(valuation.blendedEquityValue)}
              </div>
              <div className="text-xs text-muted mt-2">
                Enterprise Value: {formatCurrency(valuation.blendedEnterpriseValue)}
              </div>
            </div>

            {/* Zero Equity Guard alert */}
            {valuation.isBlendedEquityNegative && (
              <div className="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-900 leading-normal">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Zero-Equity Guard active:</strong> Computed Equity Value fell below zero due to heavy Net Debt. Limited liability rules apply. Equity Value locked to zero.
                </div>
              </div>
            )}

            {/* Custom SVG Visualization Chart */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-muted uppercase mb-3 text-center">Value Breakdown (DCF vs Multiple)</h4>
              <div className="flex justify-center items-center h-48 bg-background rounded-lg border border-border p-3 print:bg-white print:border-slate-300">
                <svg viewBox="0 0 300 160" className="w-full h-full">
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="280" y2="20" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" className="print:stroke-slate-300" />
                  <line x1="40" y1="70" x2="280" y2="70" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" className="print:stroke-slate-300" />
                  <line x1="40" y1="120" x2="280" y2="120" stroke="var(--border)" strokeWidth="1" strokeDasharray="3" className="print:stroke-slate-300" />
                  
                  {/* Y Axis Labels */}
                  <text x="35" y="24" fontSize="9" textAnchor="end" className="fill-muted print:fill-slate-600">Max</text>
                  <text x="35" y="74" fontSize="9" textAnchor="end" className="fill-muted print:fill-slate-600">Mid</text>
                  <text x="35" y="124" fontSize="9" textAnchor="end" className="fill-muted print:fill-slate-600">0</text>

                  {/* DCF Bar */}
                  <g>
                    {/* Enterprise Value Part */}
                    <rect x="70" y="30" width="40" height="90" fill="#cbd5e1" rx="2" className="print:fill-slate-200" />
                    {/* Equity Part */}
                    <rect x="70" y="55" width="40" height="65" fill="var(--accent)" rx="2" className="print:fill-slate-700" />
                    <text x="90" y="135" fontSize="10" fontWeight="bold" textAnchor="middle" className="fill-foreground print:fill-slate-900">DCF</text>
                  </g>

                  {/* EBITDA Bar */}
                  <g>
                    {/* Enterprise Value Part */}
                    <rect x="150" y="45" width="40" height="75" fill="#cbd5e1" rx="2" className="print:fill-slate-200" />
                    {/* Equity Part */}
                    <rect x="150" y="65" width="40" height="55" fill="var(--accent)" rx="2" className="print:fill-slate-700" />
                    <text x="170" y="135" fontSize="10" fontWeight="bold" textAnchor="middle" className="fill-foreground print:fill-slate-900">Multiple</text>
                  </g>

                  {/* Blended Bar */}
                  <g>
                    {/* Enterprise Value Part */}
                    <rect x="230" y="37" width="40" height="83" fill="#94a3b8" rx="2" className="print:fill-slate-400" />
                    {/* Equity Part */}
                    <rect x="230" y="60" width="40" height="60" fill="#0f172a" rx="2" className="print:fill-slate-900" />
                    <text x="250" y="135" fontSize="10" fontWeight="bold" textAnchor="middle" className="fill-foreground print:fill-slate-900">Blended</text>
                  </g>

                  {/* Legend Indicator */}
                  <rect x="10" y="150" width="8" height="8" fill="var(--accent)" className="print:fill-slate-700" />
                  <text x="22" y="157" fontSize="8" className="fill-muted print:fill-slate-600">Equity Value</text>
                  <rect x="90" y="150" width="8" height="8" fill="#cbd5e1" className="print:fill-slate-200" />
                  <text x="102" y="157" fontSize="8" className="fill-muted print:fill-slate-600">Enterprise Value</text>
                </svg>
              </div>
            </div>

          </div>

          {/* Model 1 details: DCF */}
          <div className="rounded-xl border border-border bg-surface p-5 space-y-3 shadow-sm print:border-slate-300">
            <h4 className="text-sm font-bold border-b border-border/80 pb-2 text-foreground flex justify-between items-center print:text-slate-900">
              <span>Discounted Cash Flow (DCF)</span>
              <span className="font-mono text-accent">{formatCurrency(valuation.dcfEquityValue)}</span>
            </h4>
            <div className="space-y-1.5 text-xs text-muted font-mono">
              <div className="flex justify-between">
                <span>PV of 5-Yr Forecast:</span>
                <span>{formatCurrency(valuation.pvForecast)}</span>
              </div>
              <div className="flex justify-between">
                <span>PV of Terminal Value:</span>
                <span>{formatCurrency(valuation.pvTerminalValue)}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1 font-bold text-foreground print:text-slate-900">
                <span>Enterprise Value (EV):</span>
                <span>{formatCurrency(valuation.dcfEnterpriseValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Net Debt (D - C):</span>
                <span>- {formatCurrency(valuation.netDebt)}</span>
              </div>
              <div className="flex justify-between border-t border-border/80 pt-1 font-bold text-accent print:text-slate-900">
                <span>Equity Value (EqV):</span>
                <span>{formatCurrency(valuation.dcfEquityValue)}</span>
              </div>
            </div>
          </div>

          {/* Model 2 details: Multiple */}
          <div className="rounded-xl border border-border bg-surface p-5 space-y-3 shadow-sm print:border-slate-300">
            <h4 className="text-sm font-bold border-b border-border/80 pb-2 text-foreground flex justify-between items-center print:text-slate-900">
              <span>EBITDA Multiple Method</span>
              <span className="font-mono text-accent">{formatCurrency(valuation.multipleEquityValue)}</span>
            </h4>
            <div className="space-y-1.5 text-xs text-muted font-mono">
              <div className="flex justify-between">
                <span>EBITDA Amount:</span>
                <span>{formatCurrency(ebitda)}</span>
              </div>
              <div className="flex justify-between">
                <span>EBITDA Multiple:</span>
                <span>x {multiple}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-1 font-bold text-foreground print:text-slate-900">
                <span>Enterprise Value (EV):</span>
                <span>{formatCurrency(valuation.multipleEnterpriseValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>Net Debt (D - C):</span>
                <span>- {formatCurrency(valuation.netDebt)}</span>
              </div>
              <div className="flex justify-between border-t border-border/80 pt-1 font-bold text-accent print:text-slate-900">
                <span>Equity Value (EqV):</span>
                <span>{formatCurrency(valuation.multipleEquityValue)}</span>
              </div>
            </div>
          </div>

          {/* Print-Only Report Parameters Table */}
          <div className="hidden print:block pt-4">
            <h4 className="text-sm font-bold border-b border-slate-900 pb-2 mb-2">Report Parameters & Settings</h4>
            <table className="w-full text-[10px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600">
                  <th className="py-1">Parameter</th>
                  <th className="py-1">Input Value</th>
                  <th className="py-1">Parameter</th>
                  <th className="py-1">Input Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-1 font-semibold">WACC</td>
                  <td className="py-1 font-mono">{wacc}%</td>
                  <td className="py-1 font-semibold">EBITDA</td>
                  <td className="py-1 font-mono">{formatCurrency(ebitda)}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1 font-semibold">Terminal Growth (g)</td>
                  <td className="py-1 font-mono">{growthRate}%</td>
                  <td className="py-1 font-semibold">EBITDA Multiple</td>
                  <td className="py-1 font-mono">{multiple}x</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-1 font-semibold">Total Debt</td>
                  <td className="py-1 font-mono">{formatCurrency(debt)}</td>
                  <td className="py-1 font-semibold">Cash & Cash Equiv.</td>
                  <td className="py-1 font-mono">{formatCurrency(cash)}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* Ground Truth Methodology explanations (Clean presentation) */}
      <div className="mt-12 border-t border-border pt-8 space-y-6 print:hidden">
        <h3 className="text-xl font-bold font-serif flex items-center gap-2">
          <Info className="w-5 h-5 text-accent" /> Valuation Methodology & Regulatory Context
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted leading-relaxed">
          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Discounted Cash Flow (DCF) Method</h4>
            <p>
              The Discounted Cash Flow method is the gold standard of corporate finance. It projects future cash generation (FCFs) and discounts them back to their present value using the Cost of Capital (WACC). WACC reflects the combined expected return for both debt-holders and equity-holders.
            </p>
            <p>
              The Gordon Growth Model is applied to calculate the terminal value (the value of cash flows beyond Year 5). WACC must mathematically exceed the terminal growth rate to prevent division-by-zero errors.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-foreground">Multiple Method (Relative Valuation)</h4>
            <p>
              The EBITDA multiple method compares the enterprise value of the company to its core operational profitability. This provides a market-driven reality check against DCF calculations. Multiples typically vary by industry sector, growth profile, and geography.
            </p>
            <p>
              Both methods calculate Enterprise Value first. Net Debt (Total Debt minus Cash) is then subtracted to determine the Equity Value (the actual value owned by shareholders).
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
