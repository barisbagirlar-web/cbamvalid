import { CBAMFormData } from "./schema";

export interface CalculationResult {
  totalDirectEmissions: number;
  totalIndirectEmissions: number;
  specificDirectEmissions: number;
  specificIndirectEmissions: number;
  usedGridFactor: number;
}

export function calculateEmissions(data: CBAMFormData): CalculationResult {
  // Evrensel kural: Ya kendi yeşil enerji faktörünü (Custom) kullanır ya da 
  // bulunduğu ülkenin standart faktörünü (gridEmissionFactor) girmek zorundadır.
  const factorToUse = (data.isCustomGridFactor && data.customGridFactor !== undefined) 
    ? data.customGridFactor 
    : data.gridEmissionFactor;

  const installationIndirect = data.electricityConsumed * factorToUse;
  const installationDirect = data.directEmissions;

  const precursorDirect = data.isComplexGood && data.precursorDirectEmissions ? data.precursorDirectEmissions : 0;
  const precursorIndirect = data.isComplexGood && data.precursorIndirectEmissions ? data.precursorIndirectEmissions : 0;

  const totalDirect = installationDirect + precursorDirect;
  const totalIndirect = installationIndirect + precursorIndirect;

  const specificDirect = totalDirect / data.productionVolume;
  const specificIndirect = totalIndirect / data.productionVolume;

  return {
    totalDirectEmissions: Number(totalDirect.toFixed(4)),
    totalIndirectEmissions: Number(totalIndirect.toFixed(4)),
    specificDirectEmissions: Number(specificDirect.toFixed(4)),
    specificIndirectEmissions: Number(specificIndirect.toFixed(4)),
    usedGridFactor: factorToUse,
  };
}
