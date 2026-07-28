/**
 * Precursor embedded-emissions kernel — pure.
 */
import { addEmissions, tco2e, type TCO2e } from "../00-schema/units";

export interface PrecursorInput {
  readonly direct: TCO2e;
  readonly indirect: TCO2e;
}

export interface PrecursorTotals {
  readonly direct: TCO2e;
  readonly indirect: TCO2e;
  readonly disclosedTotal: TCO2e;
}

export function sumPrecursors(items: readonly PrecursorInput[]): PrecursorTotals {
  let direct = tco2e(0);
  let indirect = tco2e(0);
  for (const item of items) {
    direct = addEmissions(direct, item.direct);
    indirect = addEmissions(indirect, item.indirect);
  }
  return {
    direct,
    indirect,
    disclosedTotal: addEmissions(direct, indirect),
  };
}
