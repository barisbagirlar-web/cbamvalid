/**
 * WP-06 — uncertainty / tier assessment.
 * TEST_FIXTURE and OFFICIAL datasets enable assessment; MISSING fails closed.
 */
import tiersDataset from "../01-ruleset/tiers.dataset.json";

export type UncertaintyDimensionState = "NOT_ASSESSED" | "ASSESSED";

export interface UncertaintyAssessment {
  readonly state: UncertaintyDimensionState;
  readonly score01: number;
  readonly findings: readonly string[];
  readonly chapterRenderable: boolean;
}

function tiersReady(): boolean {
  const status = String((tiersDataset as { status?: string }).status || "");
  return (
    (status === "TEST_FIXTURE" || status === "OFFICIAL") &&
    Array.isArray(tiersDataset.tiers) &&
    tiersDataset.tiers.length > 0
  );
}

export function assessUncertainty(params: {
  readonly sourceStreamCount: number;
  readonly streamsWithInstrument: number;
  readonly streamsWithCalibrationEvidence: number;
}): UncertaintyAssessment {
  if (!tiersReady()) {
    return Object.freeze({
      state: "NOT_ASSESSED",
      score01: 0,
      findings: Object.freeze(["TIERS_DATASET_MISSING"]),
      chapterRenderable: false,
    });
  }

  if (params.sourceStreamCount === 0 || params.streamsWithInstrument === 0) {
    return Object.freeze({
      state: "NOT_ASSESSED",
      score01: 0,
      findings: Object.freeze(["NO_INSTRUMENTS"]),
      chapterRenderable: false,
    });
  }

  if (params.streamsWithCalibrationEvidence < params.sourceStreamCount) {
    return Object.freeze({
      state: "ASSESSED",
      score01: 0,
      findings: Object.freeze(["CALIBRATION_EVIDENCE_INCOMPLETE"]),
      chapterRenderable: true,
    });
  }

  return Object.freeze({
    state: "ASSESSED",
    score01: 1,
    findings: Object.freeze([]),
    chapterRenderable: true,
  });
}
