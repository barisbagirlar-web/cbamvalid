"use client";

import React, { useState } from "react";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { ROI_SECTORS, type RoiResult } from "@/lib/billing/roi-calculator";

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function RoiCalculatorPanel() {
  const [sector, setSector] = useState<string>("STEEL");
  const [volumeRaw, setVolumeRaw] = useState("");
  const [actualRaw, setActualRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RoiResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/pricing/roi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector,
          volumeTonnes: parseOptionalNumber(volumeRaw),
          actualSeeTPerT: parseOptionalNumber(actualRaw),
        }),
      });
      const body = (await res.json()) as RoiResult;
      setResult(body);
    } catch {
      setResult({
        ok: false,
        code: "ROI_NETWORK",
        message: "Network error while calculating. Try again.",
        calculatorVersion: "roi-exposure-v1.0.0",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="deliv-card" style={{ maxWidth: "920px", margin: "0 auto" }}>
      <span className="fmt">T2.2 · ROI exposure</span>
      <h3 style={{ marginTop: "10px" }}>Default-value penalty vs actual data</h3>
      <p>
        Estimate certificate-cost exposure using official Q2 2026 CBAM certificate price (€75.28/tCO₂e)
        and CBAMValid default-factor SSOT. Missing inputs block — never silent zero.
      </p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Sector</span>
          <select value={sector} onChange={(e) => setSector(e.target.value)} required>
            {ROI_SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Annual export volume (tonnes)</span>
          <input
            inputMode="decimal"
            value={volumeRaw}
            onChange={(e) => setVolumeRaw(e.target.value)}
            placeholder="e.g. 12000"
            required
          />
        </label>
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Your estimated actual SEE (tCO₂e / t)</span>
          <input
            inputMode="decimal"
            value={actualRaw}
            onChange={(e) => setActualRaw(e.target.value)}
            placeholder="e.g. 1.45"
            required
          />
        </label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Calculating…" : "Calculate exposure"}
        </button>
      </form>

      {result && !result.ok ? (
        <div className="notice" style={{ marginTop: "18px" }}>
          <b>Blocked:</b> {result.message} <span className="mono">({result.code})</span>
        </div>
      ) : null}

      {result && result.ok ? (
        <div style={{ marginTop: "22px" }}>
          <p>
            <b>Your default-value penalty this year:</b>{" "}
            <span className="mono">€{result.defaultValuePenaltyEur.toLocaleString("en-IE")}</span>
          </p>
          <p>
            Default exposure: €{result.defaultExposureEur.toLocaleString("en-IE")} · Actual exposure: €
            {result.actualExposureEur.toLocaleString("en-IE")}
          </p>
          <p>
            Default SEE {result.defaultSeeTPerT.toFixed(2)} tCO₂e/t ({result.defaultDatasetVersion}) ·
            Certificate {result.certificatePriceEurPerT.toFixed(2)} EUR/tCO₂e (
            {result.certificateDatasetVersion})
          </p>
          <p>
            Preparation Pack: <b>{CANONICAL_PRICING.priceFormatted}</b> one-time at lock
          </p>
          <div className="notice" style={{ marginTop: "14px" }}>
            {result.notice}
          </div>
        </div>
      ) : null}
    </div>
  );
}
