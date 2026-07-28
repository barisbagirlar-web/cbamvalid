/**
 * Minimal pure kernels — direct / indirect entry points (WP-00/04).
 * No I/O. No Date.now().
 */
import { energyTimesFactor, type MWh, type TCO2e, type TCO2ePerMWh } from "../00-schema/units";

export function computeDirectFromDeclared(declared: TCO2e): TCO2e {
  return declared;
}

export function computeIndirectFromElectricity(
  electricity: MWh,
  gridFactor: TCO2ePerMWh
): TCO2e {
  return energyTimesFactor(electricity, gridFactor);
}
