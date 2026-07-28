/**
 * WP-05 — process-level attribution + non-associated flows + reconciliation.
 * PURE. Fail-closed on non-zero reconciliation delta beyond tolerance.
 */
import { Decimal, addEmissions, tco2e, type TCO2e } from "../00-schema/units";
import type { CanonicalCase, CanonicalProcess } from "../10-normalize/normalizeCase";

export interface NonAssociatedFlows {
  readonly wasteGasExportedTco2e: TCO2e;
  readonly heatExportedTco2e: TCO2e;
  readonly electricityExportedTco2e: TCO2e;
  readonly nonCbamGoodsTco2e: TCO2e;
}

export interface AttributionResult {
  readonly processes: readonly CanonicalProcess[];
  readonly nonAssociated: NonAssociatedFlows;
  readonly processDirectSum: TCO2e;
  readonly processIndirectSum: TCO2e;
  readonly reconciliationDeltaDirect: TCO2e;
  readonly reconciliationDeltaIndirect: TCO2e;
  readonly reconciled: boolean;
  readonly simplifiedAllocationFinding: {
    readonly code: "SIMPLIFIED_ALLOCATION";
    readonly severity: "OBSERVATION";
    readonly message: string;
  } | null;
}

const ZERO = tco2e(0);
const TOLERANCE = new Decimal("0.000001");

export function emptyNonAssociatedFlows(): NonAssociatedFlows {
  return Object.freeze({
    wasteGasExportedTco2e: ZERO,
    heatExportedTco2e: ZERO,
    electricityExportedTco2e: ZERO,
    nonCbamGoodsTco2e: ZERO,
  });
}

export function attributeInstallationToProcesses(
  canonical: CanonicalCase,
  nonAssociated: NonAssociatedFlows = emptyNonAssociatedFlows()
): AttributionResult {
  const processes = canonical.productionProcesses;
  const usesSimplified =
    processes.length === 0 && canonical.goods.some((g) => g.allocationShare !== null);

  if (usesSimplified) {
    for (const g of canonical.goods) {
      if (g.allocationShare !== null && !g.allocationJustification) {
        throw new Error("SIMPLIFIED_ALLOCATION_JUSTIFICATION_REQUIRED");
      }
    }
  }

  let processDirectSum = ZERO;
  let processIndirectSum = ZERO;

  if (processes.length === 0) {
    // Implicit single-process attribution of full installation totals.
    processDirectSum = canonical.directEmissions;
    processIndirectSum = tco2e(
      canonical.electricity.times(canonical.gridFactor).toString()
    );
  } else {
    for (const p of processes) {
      if (p.attributedDirect === null || p.attributedIndirect === null) {
        throw new Error(`PROCESS_ATTRIBUTION_VALUES_MISSING:${p.processId}`);
      }
      processDirectSum = addEmissions(processDirectSum, p.attributedDirect);
      processIndirectSum = addEmissions(processIndirectSum, p.attributedIndirect);
    }
  }

  const nonAssocDirect = addEmissions(
    addEmissions(nonAssociated.wasteGasExportedTco2e, nonAssociated.heatExportedTco2e),
    addEmissions(nonAssociated.electricityExportedTco2e, nonAssociated.nonCbamGoodsTco2e)
  );

  const reconDirect = tco2e(
    processDirectSum.plus(nonAssocDirect).minus(canonical.directEmissions).toString()
  );
  const expectedIndirect = tco2e(
    canonical.electricity.times(canonical.gridFactor).toString()
  );
  const reconIndirect = tco2e(processIndirectSum.minus(expectedIndirect).toString());

  const reconciled =
    reconDirect.abs().lte(TOLERANCE) && reconIndirect.abs().lte(TOLERANCE);

  if (!reconciled) {
    throw new Error(
      `ATTRIBUTION_RECONCILIATION_FAILED:direct=${reconDirect.toString()},indirect=${reconIndirect.toString()}`
    );
  }

  return Object.freeze({
    processes,
    nonAssociated: Object.freeze({ ...nonAssociated }),
    processDirectSum,
    processIndirectSum,
    reconciliationDeltaDirect: reconDirect,
    reconciliationDeltaIndirect: reconIndirect,
    reconciled: true,
    simplifiedAllocationFinding: usesSimplified
      ? ({
          code: "SIMPLIFIED_ALLOCATION" as const,
          severity: "OBSERVATION" as const,
          message:
            "Operator used allocationShare without process-level monitoring. Verifier must review justification.",
        } as const)
      : null,
  });
}
