"use client";

import { useMemo, useState } from "react";
import { trackSeoEvent } from "@/lib/seo/analytics-events";

type FormState = {
  cnCode: string;
  tonnage: string;
  embeddedEmissionsTco2PerT: string;
  euaPriceEurPerTco2: string;
  cbamExposurePct: string;
  carbonPricePaidEurPerTco2: string;
  contractValueEur: string;
  incoterm: string;
};

type Result = {
  engineVersion: string;
  payableEmbeddedEmissionsTco2: number;
  scenarios: Array<{
    label: "low" | "base" | "high";
    euaPriceEurPerTco2: number;
    certificateCostPerTonneEur: number;
    totalContractImpactEur: number;
    marginImpactPct: number | null;
  }>;
  assumptions: string[];
};

const initial: FormState = {
  cnCode: "720851",
  tonnage: "1000",
  embeddedEmissionsTco2PerT: "1.85",
  euaPriceEurPerTco2: "80",
  cbamExposurePct: "2.5",
  carbonPricePaidEurPerTco2: "0",
  contractValueEur: "750000",
  incoterm: "FOB",
};

function payload(form: FormState) {
  return {
    cnCode: form.cnCode,
    tonnage: Number(form.tonnage),
    embeddedEmissionsTco2PerT: Number(form.embeddedEmissionsTco2PerT),
    euaPriceEurPerTco2: Number(form.euaPriceEurPerTco2),
    cbamExposurePct: Number(form.cbamExposurePct),
    carbonPricePaidEurPerTco2: Number(form.carbonPricePaidEurPerTco2),
    contractValueEur: form.contractValueEur.trim() ? Number(form.contractValueEur) : undefined,
    incoterm: form.incoterm,
  };
}

export function CbamPassThroughCalculator() {
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = useMemo(() => result?.scenarios.find((s) => s.label === "base") ?? null, [result]);

  const set = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function calculate() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/tools/cbam-cost-pass-through", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(form)),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Calculation failed");
      setResult(body);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Calculation failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadLetter() {
    const response = await fetch("/api/tools/cbam-cost-pass-through/letter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(form)),
    });
    if (!response.ok) {
      setError("PDF generation failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `CBAM-Cost-Impact-${form.cnCode}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const fields: Array<[keyof FormState, string, string]> = [
    ["cnCode", "CN code", "720851"],
    ["tonnage", "Contract tonnage", "1000"],
    ["embeddedEmissionsTco2PerT", "Embedded emissions (tCO2e/t)", "1.85"],
    ["euaPriceEurPerTco2", "Base EUA price (EUR/tCO2e)", "80"],
    ["cbamExposurePct", "CBAM exposure after free allocation (%)", "2.5"],
    ["carbonPricePaidEurPerTco2", "Carbon price paid (EUR/tCO2e)", "0"],
    ["contractValueEur", "Contract value (EUR, optional)", "750000"],
    ["incoterm", "Incoterm", "FOB"],
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
      <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map(([key, label, placeholder]) => (
            <label key={key} className="grid gap-1 text-sm font-medium">
              {label}
              <input
                value={form[key]}
                placeholder={placeholder}
                onChange={(event) => set(key, event.target.value)}
                className="min-h-11 rounded-md border border-border bg-background px-3 text-foreground outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={calculate}
          disabled={busy}
          className="mt-6 min-h-11 rounded-md bg-accent px-5 py-2.5 font-semibold text-surface disabled:opacity-60"
        >
          {busy ? "Calculating…" : "Calculate contract impact"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-background p-6">
        <h2 className="text-xl font-semibold">Commercial impact</h2>
        {!result || !base ? (
          <p className="mt-3 text-sm text-muted">Enter contract assumptions to produce deterministic low, base and high scenarios.</p>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Base case total</p>
              <p className="mt-1 text-3xl font-bold">EUR {base.totalContractImpactEur.toLocaleString("en-US")}</p>
              <p className="mt-1 text-sm text-muted">EUR {base.certificateCostPerTonneEur.toLocaleString("en-US")} per tonne</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {result.scenarios.map((scenario) => (
                <div key={scenario.label} className="rounded-md border border-border p-3">
                  <p className="text-xs font-semibold uppercase">{scenario.label}</p>
                  <p className="mt-1 text-sm">EUR {scenario.totalContractImpactEur.toLocaleString("en-US")}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">Engine {result.engineVersion} · payable emissions {result.payableEmbeddedEmissionsTco2} tCO2e</p>
            <button type="button" onClick={downloadLetter} className="min-h-11 rounded-md border border-accent px-4 py-2 text-sm font-semibold text-accent">
              Download CBAM Cost Impact Letter
            </button>
            <a
              href="/register"
              onClick={() => trackSeoEvent("passthrough_to_draft", { landingPage: "/tools/cbam-cost-pass-through" })}
              className="block text-sm font-semibold text-accent underline"
            >
              Turn this estimate into a working file → Start Free Draft
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
