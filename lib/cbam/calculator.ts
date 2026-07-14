import { Decimal } from "decimal.js";
import { AuditReadyCase, CalculationTraceNode, UnitCode } from "./schema";

// Set strict precision rules for CBAM
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function hashObject(obj: any): string {
  // Mock cryptographic hash for client-side trace building
  // In production, this would use WebCrypto or crypto module
  return "hash_" + Math.random().toString(36).substring(2, 10);
}

export const FormulaRegistry = {
  "EU_CBAM_INDIRECT_01": {
    version: "2025/2547 v2.0",
    source: "Delegated Regulation (EU) 2025/2547",
    effectiveDate: "2026-01-01",
    expectedInputUnits: { electricityConsumed: "MWh", gridFactor: "tCO2e/MWh" },
    outputUnit: "tCO2e"
  },
  "EU_CBAM_PRECURSOR_SUM": {
    version: "2025/2547 v2.0",
    source: "Delegated Regulation (EU) 2025/2547",
    effectiveDate: "2026-01-01",
    expectedInputUnits: { precursorDirect: "tCO2e", precursorIndirect: "tCO2e" },
    outputUnit: "tCO2e"
  },
  "EU_CBAM_TOTAL_ATTRIBUTED": {
    version: "2025/2547 v2.0",
    source: "Delegated Regulation (EU) 2025/2547",
    effectiveDate: "2026-01-01",
    expectedInputUnits: { direct: "tCO2e", indirect: "tCO2e", precursors: "tCO2e" },
    outputUnit: "tCO2e"
  },
  "EU_CBAM_SPECIFIC_EMISSIONS": {
    version: "2025/2547 v2.0",
    source: "Delegated Regulation (EU) 2025/2547",
    effectiveDate: "2026-01-01",
    expectedInputUnits: { totalEmissions: "tCO2e", productionVolume: "t" },
    outputUnit: "tCO2e/t"
  },
  "EU_CBAM_CARBON_PRICE_REBATE": {
    version: "2025/2547 v2.0",
    source: "Delegated Regulation (EU) 2025/2547",
    effectiveDate: "2026-01-01",
    expectedInputUnits: { rebate: "EUR" },
    outputUnit: "EUR"
  }
};

export function performDossierCalculations(caseData: AuditReadyCase): { trace: CalculationTraceNode[], totalEmbeddedEmissions: string } {
  const trace: CalculationTraceNode[] = [];
  
  const getDec = (val: any): Decimal | null => {
    if (val === null || val === undefined || val === "") return null;
    const parsed = new Decimal(val);
    if (parsed.isNaN()) {
      throw new Error(`Dimensional Safety Error: Invalid number parsed: ${val}`);
    }
    return parsed;
  };

  const directEmissions = getDec(caseData.directEmissions.value);
  const electricityConsumed = getDec(caseData.electricityConsumed.value);
  const gridFactor = getDec(caseData.gridEmissionFactor.value);
  
  let productionVolume: Decimal | null = new Decimal(0);
  if (caseData.goods.length === 0) {
    productionVolume = null;
  } else {
    for (const good of caseData.goods) {
      const vol = getDec(good.productionVolume.value);
      if (vol === null) {
        productionVolume = null;
        break;
      } else if (productionVolume) {
        productionVolume = productionVolume.plus(vol);
      }
    }
  }

  // Helper to create trace for missing data
  const createMissingTrace = (id: string, formulaId: string, inputs: any): CalculationTraceNode => ({
    calculationId: crypto.randomUUID(),
    formulaId,
    formulaVersion: FormulaRegistry[formulaId as keyof typeof FormulaRegistry]?.version || "2025/2547 v2.0",
    officialSource: FormulaRegistry[formulaId as keyof typeof FormulaRegistry]?.source || "Delegated Regulation (EU) 2025/2547",
    sourceVersion: "2.0",
    effectiveDate: "2026-01-01",
    inputs,
    assumptions: [],
    warnings: ["Missing required input parameter"],
    outputValue: "NOT_CALCULATED",
    outputUnit: FormulaRegistry[formulaId as keyof typeof FormulaRegistry]?.outputUnit as any || "tCO2e",
    calculationHash: hashObject({ inputs, status: "NOT_CALCULATED" })
  });

  // 1. Indirect Emissions Calculation
  let indirectEmissions: Decimal | null = null;
  if (electricityConsumed === null || gridFactor === null) {
    trace.push(createMissingTrace("indirect", "EU_CBAM_INDIRECT_01", { 
      electricityConsumed: electricityConsumed?.toString() || "null", 
      gridFactor: gridFactor?.toString() || "null" 
    }));
  } else {
    indirectEmissions = electricityConsumed.times(gridFactor);
    trace.push({
      calculationId: crypto.randomUUID(),
      formulaId: "EU_CBAM_INDIRECT_01",
      formulaVersion: "2025/2547 v2.0",
      officialSource: "Delegated Regulation (EU) 2025/2547",
      sourceVersion: "2.0",
      effectiveDate: "2026-01-01",
      inputs: { electricityConsumed: electricityConsumed.toString(), gridFactor: gridFactor.toString() },
      assumptions: ["Grid factor represents regional average if actual PPA not verified"],
      warnings: [],
      outputValue: indirectEmissions.toString(),
      outputUnit: "tCO2e",
      calculationHash: hashObject({ electricityConsumed: electricityConsumed.toString(), gridFactor: gridFactor.toString() })
    });
  }

  // 2. Precursor Emissions
  let precursorDirectTotal: Decimal | null = new Decimal(0);
  let precursorIndirectTotal: Decimal | null = new Decimal(0);
  
  if (caseData.precursors.length > 0) {
    for (const prec of caseData.precursors) {
      const d = getDec(prec.directEmissions.value);
      const i = getDec(prec.indirectEmissions.value);
      if (d === null || i === null) {
        precursorDirectTotal = null;
        precursorIndirectTotal = null;
        break;
      }
      if (precursorDirectTotal && precursorIndirectTotal) {
        precursorDirectTotal = precursorDirectTotal.plus(d);
        precursorIndirectTotal = precursorIndirectTotal.plus(i);
      }
    }
    
    if (precursorDirectTotal === null || precursorIndirectTotal === null) {
      trace.push(createMissingTrace("precursor", "EU_CBAM_PRECURSOR_SUM", { count: caseData.precursors.length, missingValues: true }));
    } else {
      trace.push({
        calculationId: crypto.randomUUID(),
        formulaId: "EU_CBAM_PRECURSOR_SUM",
        formulaVersion: "2025/2547 v2.0",
        officialSource: "Delegated Regulation (EU) 2025/2547",
        sourceVersion: "2.0",
        effectiveDate: "2026-01-01",
        inputs: { count: caseData.precursors.length },
        assumptions: [],
        warnings: [],
        outputValue: precursorDirectTotal.plus(precursorIndirectTotal).toString(),
        outputUnit: "tCO2e",
        calculationHash: hashObject({ precursorDirectTotal: precursorDirectTotal.toString(), precursorIndirectTotal: precursorIndirectTotal.toString() })
      });
    }
  }

  // 3. Total Attributed Emissions
  let totalEmissions: Decimal | null = null;
  if (directEmissions === null || indirectEmissions === null || precursorDirectTotal === null || precursorIndirectTotal === null) {
    trace.push(createMissingTrace("total", "EU_CBAM_TOTAL_ATTRIBUTED", { 
      directEmissions: directEmissions?.toString() || "null", 
      indirectEmissions: indirectEmissions?.toString() || "null", 
      precursorDirectTotal: precursorDirectTotal?.toString() || "null", 
      precursorIndirectTotal: precursorIndirectTotal?.toString() || "null" 
    }));
  } else {
    const totalDirect = directEmissions.plus(precursorDirectTotal);
    const totalIndirect = indirectEmissions.plus(precursorIndirectTotal);
    totalEmissions = totalDirect.plus(totalIndirect);

    trace.push({
      calculationId: crypto.randomUUID(),
      formulaId: "EU_CBAM_TOTAL_ATTRIBUTED",
      formulaVersion: "2025/2547 v2.0",
      officialSource: "Delegated Regulation (EU) 2025/2547",
      sourceVersion: "2.0",
      effectiveDate: "2026-01-01",
      inputs: { 
        directEmissions: directEmissions.toString(), 
        indirectEmissions: indirectEmissions.toString(), 
        precursorDirectTotal: precursorDirectTotal.toString(), 
        precursorIndirectTotal: precursorIndirectTotal.toString() 
      },
      assumptions: [],
      warnings: [],
      outputValue: totalEmissions.toString(),
      outputUnit: "tCO2e",
      calculationHash: hashObject({ totalDirect: totalDirect.toString(), totalIndirect: totalIndirect.toString() })
    });
  }

  // 4. Specific Embedded Emissions
  let specificEmissions: Decimal | null = null;
  if (totalEmissions === null || productionVolume === null) {
    trace.push(createMissingTrace("specific", "EU_CBAM_SPECIFIC_EMISSIONS", { 
      totalEmissions: totalEmissions?.toString() || "null", 
      productionVolume: productionVolume?.toString() || "null" 
    }));
  } else if (productionVolume.greaterThan(0)) {
    specificEmissions = totalEmissions.dividedBy(productionVolume);
    trace.push({
      calculationId: crypto.randomUUID(),
      formulaId: "EU_CBAM_SPECIFIC_EMISSIONS",
      formulaVersion: "2025/2547 v2.0",
      officialSource: "Delegated Regulation (EU) 2025/2547",
      sourceVersion: "2.0",
      effectiveDate: "2026-01-01",
      inputs: { totalEmissions: totalEmissions.toString(), productionVolume: productionVolume.toString() },
      assumptions: [],
      warnings: productionVolume.lessThan(1) ? ["Production volume is very low, specific emissions may be distorted"] : [],
      outputValue: specificEmissions.toDecimalPlaces(4).toString(),
      outputUnit: "tCO2e/t",
      calculationHash: hashObject({ totalEmissions: totalEmissions.toString(), productionVolume: productionVolume.toString() })
    });
  } else {
    trace.push({
      calculationId: crypto.randomUUID(),
      formulaId: "EU_CBAM_SPECIFIC_EMISSIONS",
      formulaVersion: "2025/2547 v2.0",
      officialSource: "Delegated Regulation (EU) 2025/2547",
      sourceVersion: "2.0",
      effectiveDate: "2026-01-01",
      inputs: { totalEmissions: totalEmissions.toString(), productionVolume: productionVolume.toString() },
      assumptions: [],
      warnings: ["Production volume is zero or invalid. Cannot calculate specific emissions."],
      outputValue: "0",
      outputUnit: "tCO2e/t",
      calculationHash: hashObject({ totalEmissions: totalEmissions.toString(), productionVolume: productionVolume.toString() })
    });
  }

  // 5. Carbon Price Deductions
  let totalRebate: Decimal | null = new Decimal(0);
  if (caseData.carbonPriceRecords.length > 0) {
    for (const rec of caseData.carbonPriceRecords) {
      const dec = getDec(rec.eligibleCertificateReduction);
      if (dec === null) {
        totalRebate = null;
        break;
      } else if (totalRebate) {
        totalRebate = totalRebate.plus(dec);
      }
    }
    
    if (totalRebate === null) {
      trace.push(createMissingTrace("rebate", "EU_CBAM_CARBON_PRICE_REBATE", { records: caseData.carbonPriceRecords.length, missingValues: true }));
    } else {
      trace.push({
        calculationId: crypto.randomUUID(),
        formulaId: "EU_CBAM_CARBON_PRICE_REBATE",
        formulaVersion: "2025/2547 v2.0",
        officialSource: "Delegated Regulation (EU) 2025/2547",
        sourceVersion: "2.0",
        effectiveDate: "2026-01-01",
        inputs: { records: caseData.carbonPriceRecords.length },
        assumptions: ["Carbon price paid is fully eligible and not otherwise compensated"],
        warnings: [],
        outputValue: totalRebate.toString(),
        outputUnit: "EUR",
        calculationHash: hashObject({ totalRebate: totalRebate.toString() })
      });
    }
  }

  return { trace, totalEmbeddedEmissions: specificEmissions !== null ? specificEmissions.toDecimalPlaces(4).toString() : "NOT_CALCULATED" };
}
