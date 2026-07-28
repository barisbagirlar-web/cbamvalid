/**
 * Branded physical quantities + dimensional operators.
 * Arithmetic on emission/mass/energy values is ONLY permitted through these operators.
 */
import { Decimal } from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Tonne = Brand<Decimal, "t">;
export type MWh = Brand<Decimal, "MWh">;
export type TCO2e = Brand<Decimal, "tCO2e">;
export type TCO2ePerMWh = Brand<Decimal, "tCO2e/MWh">;
export type TCO2ePerTonne = Brand<Decimal, "tCO2e/t">;
export type Fraction = Brand<Decimal, "fraction">;

export type UnitSymbol = "t" | "MWh" | "tCO2e" | "tCO2e/MWh" | "tCO2e/t" | "fraction";

export type CoverageBasis = "DAYS" | "RECORDS" | "FRACTION" | "BOOLEAN";

export interface Coverage {
  readonly numerator: Decimal;
  readonly denominator: Decimal;
  readonly basis: CoverageBasis;
}

export interface RoundingPolicy {
  readonly method: "HALF_UP";
  readonly displayDp: Readonly<Partial<Record<UnitSymbol, number>>>;
}

export const DEFAULT_ROUNDING: RoundingPolicy = {
  method: "HALF_UP",
  displayDp: {
    t: 3,
    MWh: 3,
    tCO2e: 3,
    "tCO2e/MWh": 6,
    "tCO2e/t": 6,
    fraction: 6,
  },
};

function asBrand<B extends string>(value: Decimal.Value, _unit: B): Brand<Decimal, B> {
  const d = value instanceof Decimal ? value : new Decimal(value);
  if (!d.isFinite()) throw new Error(`UNIT_NOT_FINITE:${_unit}`);
  return d as Brand<Decimal, B>;
}

export const tonne = (v: Decimal.Value): Tonne => asBrand(v, "t");
export const mwh = (v: Decimal.Value): MWh => asBrand(v, "MWh");
export const tco2e = (v: Decimal.Value): TCO2e => asBrand(v, "tCO2e");
export const tco2ePerMWh = (v: Decimal.Value): TCO2ePerMWh => asBrand(v, "tCO2e/MWh");
export const tco2ePerTonne = (v: Decimal.Value): TCO2ePerTonne => asBrand(v, "tCO2e/t");
export const fraction = (v: Decimal.Value): Fraction => {
  const f = asBrand(v, "fraction");
  if (f.lt(0) || f.gt(1)) throw new Error(`FRACTION_OUT_OF_RANGE:${f.toString()}`);
  return f;
};

export const energyTimesFactor = (e: MWh, f: TCO2ePerMWh): TCO2e =>
  tco2e(e.times(f));

export const emissionsPerMass = (e: TCO2e, m: Tonne): TCO2ePerTonne => {
  if (m.lte(0)) throw new Error("EMISSIONS_PER_MASS_ZERO_DENOMINATOR");
  return tco2ePerTonne(e.dividedBy(m));
};

export const addEmissions = (a: TCO2e, b: TCO2e): TCO2e => tco2e(a.plus(b));

export const addPerMass = (a: TCO2ePerTonne, b: TCO2ePerTonne): TCO2ePerTonne =>
  tco2ePerTonne(a.plus(b));

export const scaleByFraction = (e: TCO2e, f: Fraction): TCO2e => tco2e(e.times(f));

export const formatCoverage = (c: Coverage): string => {
  const n = c.numerator.toString();
  const d = c.denominator.toString();
  switch (c.basis) {
    case "DAYS":
      return `${n} / ${d} days`;
    case "RECORDS":
      return `${n} / ${d} records`;
    case "BOOLEAN":
      return `${n} / ${d} boolean`;
    case "FRACTION":
      return `${n} / ${d} fraction`;
    default: {
      const _exhaustive: never = c.basis;
      return _exhaustive;
    }
  }
};

export const formatQuantity = (
  value: Decimal,
  unit: UnitSymbol,
  policy: RoundingPolicy = DEFAULT_ROUNDING
): string => {
  const dp = policy.displayDp[unit] ?? 6;
  return `${value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toFixed(dp)} ${unit}`;
};

export { Decimal };
