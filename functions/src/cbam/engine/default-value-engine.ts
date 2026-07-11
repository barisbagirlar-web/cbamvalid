export interface DefaultEmissions {
  directFactor: number; // tCO2e per unit (tonne or MWh)
  indirectFactor: number;
  unit: "t" | "MWh";
  datasetVersion: string;
}

const DEFAULT_VALUES_MAP: Record<string, Omit<DefaultEmissions, "datasetVersion">> = {
  CEMENT: { directFactor: 0.76, indirectFactor: 0.08, unit: "t" },
  STEEL: { directFactor: 1.89, indirectFactor: 0.42, unit: "t" },
  ALUMINIUM: { directFactor: 8.24, indirectFactor: 10.21, unit: "t" },
  FERTILIZER: { directFactor: 2.11, indirectFactor: 0.35, unit: "t" },
  ELECTRICITY: { directFactor: 0.45, indirectFactor: 0.0, unit: "MWh" },
  HYDROGEN: { directFactor: 9.85, indirectFactor: 1.2, unit: "t" },
};

export function getDefaultEmissions(sector: string): DefaultEmissions | null {
  const defaults = DEFAULT_VALUES_MAP[sector];
  if (!defaults) {
    return null;
  }
  return {
    ...defaults,
    datasetVersion: "EU_DEFAULT_VALUES_2026_V1.0",
  };
}
