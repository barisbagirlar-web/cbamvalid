import { Decimal } from "decimal.js";
import { AuditReadyCase, CalculationTraceNode } from "./schema";

// Set strict precision rules for CBAM
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

function hashObject(obj: any): string {
  // Mock cryptographic hash for client-side trace building
  // In production, this would use WebCrypto or crypto module
  return "hash_" + Math.random().toString(36).substring(2, 10);
}

export function performDossierCalculations(caseData: AuditReadyCase): { trace: CalculationTraceNode[], totalEmbeddedEmissions: number } {
  const trace: CalculationTraceNode[] = [];
  
  const getDec = (val: any): Decimal => {
    if (val === null || val === undefined) return new Decimal(0);
    try {
      return new Decimal(val);
    } catch {
      return new Decimal(0);
    }
  };

  const directEmissions = getDec(caseData.directEmissions.value);
  const electricityConsumed = getDec(caseData.electricityConsumed.value);
  const gridFactor = getDec(caseData.gridEmissionFactor.value);
  
  let productionVolume = new Decimal(0);
  for (const good of caseData.goods) {
    productionVolume = productionVolume.plus(getDec(good.productionVolume.value));
  }

  // 1. Indirect Emissions Calculation
  const indirectEmissions = electricityConsumed.times(gridFactor);
  trace.push({
    calculationId: crypto.randomUUID(),
    formulaId: "EU_CBAM_INDIRECT_01",
    formulaVersion: "2023/1773 v1.0",
    officialSource: "Implementing Regulation (EU) 2023/1773",
    sourceVersion: "1.0",
    effectiveDate: "2023-10-01",
    inputs: { electricityConsumed: electricityConsumed.toString(), gridFactor: gridFactor.toString() },
    assumptions: ["Grid factor represents regional average if actual PPA not verified"],
    warnings: [],
    outputValue: indirectEmissions.toNumber(),
    outputUnit: "tCO2e",
    calculationHash: hashObject({ electricityConsumed: electricityConsumed.toString(), gridFactor: gridFactor.toString() })
  });

  // 2. Precursor Emissions
  let precursorDirectTotal = new Decimal(0);
  let precursorIndirectTotal = new Decimal(0);
  
  if (caseData.precursors.length > 0) {
    for (const prec of caseData.precursors) {
      precursorDirectTotal = precursorDirectTotal.plus(getDec(prec.directEmissions.value));
      precursorIndirectTotal = precursorIndirectTotal.plus(getDec(prec.indirectEmissions.value));
    }
    
    trace.push({
      calculationId: crypto.randomUUID(),
      formulaId: "EU_CBAM_PRECURSOR_SUM",
      formulaVersion: "2023/1773 v1.0",
      officialSource: "Implementing Regulation (EU) 2023/1773",
      sourceVersion: "1.0",
      effectiveDate: "2023-10-01",
      inputs: { count: caseData.precursors.length },
      assumptions: [],
      warnings: [],
      outputValue: precursorDirectTotal.plus(precursorIndirectTotal).toNumber(),
      outputUnit: "tCO2e",
      calculationHash: hashObject({ precursorDirectTotal: precursorDirectTotal.toString(), precursorIndirectTotal: precursorIndirectTotal.toString() })
    });
  }

  // 3. Total Attributed Emissions
  const totalDirect = directEmissions.plus(precursorDirectTotal);
  const totalIndirect = indirectEmissions.plus(precursorIndirectTotal);
  const totalEmissions = totalDirect.plus(totalIndirect);

  trace.push({
    calculationId: crypto.randomUUID(),
    formulaId: "EU_CBAM_TOTAL_ATTRIBUTED",
    formulaVersion: "2023/1773 v1.0",
    officialSource: "Implementing Regulation (EU) 2023/1773",
    sourceVersion: "1.0",
    effectiveDate: "2023-10-01",
    inputs: { 
      directEmissions: directEmissions.toString(), 
      indirectEmissions: indirectEmissions.toString(), 
      precursorDirectTotal: precursorDirectTotal.toString(), 
      precursorIndirectTotal: precursorIndirectTotal.toString() 
    },
    assumptions: [],
    warnings: [],
    outputValue: totalEmissions.toNumber(),
    outputUnit: "tCO2e",
    calculationHash: hashObject({ totalDirect: totalDirect.toString(), totalIndirect: totalIndirect.toString() })
  });

  // 4. Specific Embedded Emissions
  let specificEmissions = new Decimal(0);
  if (productionVolume.greaterThan(0)) {
    specificEmissions = totalEmissions.dividedBy(productionVolume);
    trace.push({
      calculationId: crypto.randomUUID(),
      formulaId: "EU_CBAM_SPECIFIC_EMISSIONS",
      formulaVersion: "2023/1773 v1.0",
      officialSource: "Implementing Regulation (EU) 2023/1773",
      sourceVersion: "1.0",
      effectiveDate: "2023-10-01",
      inputs: { totalEmissions: totalEmissions.toString(), productionVolume: productionVolume.toString() },
      assumptions: [],
      warnings: productionVolume.lessThan(1) ? ["Production volume is very low, specific emissions may be distorted"] : [],
      outputValue: specificEmissions.toDecimalPlaces(4).toNumber(),
      outputUnit: "tCO2e/tonne",
      calculationHash: hashObject({ totalEmissions: totalEmissions.toString(), productionVolume: productionVolume.toString() })
    });
  } else {
    trace.push({
      calculationId: crypto.randomUUID(),
      formulaId: "EU_CBAM_SPECIFIC_EMISSIONS",
      formulaVersion: "2023/1773 v1.0",
      officialSource: "Implementing Regulation (EU) 2023/1773",
      sourceVersion: "1.0",
      effectiveDate: "2023-10-01",
      inputs: { totalEmissions: totalEmissions.toString(), productionVolume: productionVolume.toString() },
      assumptions: [],
      warnings: ["Production volume is zero or invalid. Cannot calculate specific emissions."],
      outputValue: 0,
      outputUnit: "tCO2e/tonne",
      calculationHash: hashObject({ totalEmissions: totalEmissions.toString(), productionVolume: productionVolume.toString() })
    });
  }

  // 5. Carbon Price Deductions
  let totalRebate = new Decimal(0);
  if (caseData.carbonPriceRecords.length > 0) {
    for (const rec of caseData.carbonPriceRecords) {
      totalRebate = totalRebate.plus(getDec(rec.eligibleCertificateReduction));
    }
    trace.push({
      calculationId: crypto.randomUUID(),
      formulaId: "EU_CBAM_CARBON_PRICE_REBATE",
      formulaVersion: "2023/1773 v1.0",
      officialSource: "Implementing Regulation (EU) 2023/1773",
      sourceVersion: "1.0",
      effectiveDate: "2023-10-01",
      inputs: { records: caseData.carbonPriceRecords.length },
      assumptions: ["Carbon price paid is fully eligible and not otherwise compensated"],
      warnings: [],
      outputValue: totalRebate.toNumber(),
      outputUnit: "CBAM Certificates Equivalent",
      calculationHash: hashObject({ totalRebate: totalRebate.toString() })
    });
  }

  return { trace, totalEmbeddedEmissions: specificEmissions.toDecimalPlaces(4).toNumber() };
}
