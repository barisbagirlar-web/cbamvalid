export type CalibrationConfig = {
  thresholds: { calibrationMaxAgeDays: number; calibrationMinSample: number; calibrationMinRho: number };
};

export type CalibrationInput = {
  calibratedAt: string | null;
  sampleSize: number;
  rho: number | null;
};

export function validateCalibration(input: CalibrationInput, config: CalibrationConfig, now = new Date()) {
  if (!input.calibratedAt || input.sampleSize === 0 || input.rho === null) {
    return { status: "SKIP_NO_DATA" as const, ageDays: null, sampleSize: input.sampleSize, rho: input.rho };
  }
  const parsed = Date.parse(input.calibratedAt);
  if (!Number.isFinite(parsed)) throw new Error("INV-K.1 calibration timestamp is invalid");
  const ageDays = Math.max(0, (now.getTime() - parsed) / 86_400_000);
  if (ageDays > config.thresholds.calibrationMaxAgeDays) throw new Error("INV-K.1 calibration evidence is stale");
  if (input.sampleSize < config.thresholds.calibrationMinSample) {
    return { status: "WARN_LOW_SAMPLE" as const, ageDays, sampleSize: input.sampleSize, rho: input.rho };
  }
  if (input.rho < config.thresholds.calibrationMinRho) {
    return { status: "WARN_LOW_CORRELATION" as const, ageDays, sampleSize: input.sampleSize, rho: input.rho };
  }
  return { status: "PASS" as const, ageDays, sampleSize: input.sampleSize, rho: input.rho };
}
