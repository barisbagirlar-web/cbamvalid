export const CBAM_PASS_THROUGH_ENGINE_VERSION = "cbam-pass-through/1.0.0" as const;

export type CbamPassThroughInput = {
  cnCode: string;
  tonnage: number;
  embeddedEmissionsTco2PerT: number;
  euaPriceEurPerTco2: number;
  cbamExposurePct: number;
  carbonPricePaidEurPerTco2: number;
  contractValueEur?: number;
  incoterm: string;
};

export type CbamPassThroughScenario = {
  label: "low" | "base" | "high";
  euaPriceEurPerTco2: number;
  certificateCostPerTonneEur: number;
  totalContractImpactEur: number;
  marginImpactPct: number | null;
};

export type CbamPassThroughResult = {
  engineVersion: typeof CBAM_PASS_THROUGH_ENGINE_VERSION;
  normalizedInput: CbamPassThroughInput;
  payableEmbeddedEmissionsTco2: number;
  netCertificatePriceEurPerTco2: number;
  scenarios: readonly CbamPassThroughScenario[];
  assumptions: readonly string[];
};

function finiteNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
  return value;
}

function boundedPercent(value: number, field: string): number {
  finiteNonNegative(value, field);
  if (value > 100) throw new Error(`INVALID_${field.toUpperCase()}`);
  return value;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function decimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function normalizeCbamPassThroughInput(input: CbamPassThroughInput): CbamPassThroughInput {
  const cnCode = input.cnCode.trim().replace(/\s+/g, "");
  if (!/^\d{4,10}$/.test(cnCode)) throw new Error("INVALID_CN_CODE");
  const incoterm = input.incoterm.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(incoterm)) throw new Error("INVALID_INCOTERM");

  return {
    cnCode,
    tonnage: finiteNonNegative(input.tonnage, "tonnage"),
    embeddedEmissionsTco2PerT: finiteNonNegative(input.embeddedEmissionsTco2PerT, "embedded_emissions"),
    euaPriceEurPerTco2: finiteNonNegative(input.euaPriceEurPerTco2, "eua_price"),
    cbamExposurePct: boundedPercent(input.cbamExposurePct, "cbam_exposure_pct"),
    carbonPricePaidEurPerTco2: finiteNonNegative(input.carbonPricePaidEurPerTco2, "carbon_price_paid"),
    contractValueEur:
      input.contractValueEur == null ? undefined : finiteNonNegative(input.contractValueEur, "contract_value"),
    incoterm,
  };
}

export function calculateCbamPassThrough(input: CbamPassThroughInput): CbamPassThroughResult {
  const normalized = normalizeCbamPassThroughInput(input);
  const payableEmbeddedEmissionsTco2 =
    normalized.tonnage * normalized.embeddedEmissionsTco2PerT * (normalized.cbamExposurePct / 100);

  const scenarioPrices = [
    { label: "low" as const, price: normalized.euaPriceEurPerTco2 * 0.8 },
    { label: "base" as const, price: normalized.euaPriceEurPerTco2 },
    { label: "high" as const, price: normalized.euaPriceEurPerTco2 * 1.2 },
  ];

  const scenarios = scenarioPrices.map(({ label, price }) => {
    const netPrice = Math.max(0, price - normalized.carbonPricePaidEurPerTco2);
    const total = payableEmbeddedEmissionsTco2 * netPrice;
    const perTonne = normalized.tonnage === 0 ? 0 : total / normalized.tonnage;
    return {
      label,
      euaPriceEurPerTco2: money(price),
      certificateCostPerTonneEur: money(perTonne),
      totalContractImpactEur: money(total),
      marginImpactPct:
        normalized.contractValueEur && normalized.contractValueEur > 0
          ? decimal((total / normalized.contractValueEur) * 100)
          : null,
    } satisfies CbamPassThroughScenario;
  });

  return {
    engineVersion: CBAM_PASS_THROUGH_ENGINE_VERSION,
    normalizedInput: normalized,
    payableEmbeddedEmissionsTco2: decimal(payableEmbeddedEmissionsTco2),
    netCertificatePriceEurPerTco2: money(
      Math.max(0, normalized.euaPriceEurPerTco2 - normalized.carbonPricePaidEurPerTco2),
    ),
    scenarios,
    assumptions: [
      "Scenario EUA prices are deterministic ±20% bands around the user-entered base price.",
      "CBAM exposure percentage is user-entered and represents the payable share after any applicable free-allocation adjustment.",
      "Carbon price paid is treated as a per-tCO2 monetary deduction and cannot reduce the modeled certificate price below zero.",
      "This calculator is a negotiation and planning tool, not an official declaration, customs filing, verification opinion or legal advice.",
    ],
  };
}
