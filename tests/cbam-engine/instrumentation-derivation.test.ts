/**
 * FAZ P0 (ISS-03/ISS-06) — honest instrumentation derivation.
 *
 * The sealed dossier must never fabricate meter identifiers or uncertainty
 * values. Source streams are derived from the case's own activity data and the
 * meter register from approved calibration certificates. A case without
 * calibration evidence has no declared instruments (fail-closed).
 */
import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { createFourDossierCase, buildFourDossierEvidenceFiles } from "../fixtures/four-dossiers";
import {
  calibrationCertificatesOf,
  deriveInstrumentation,
  meterIdForCertificate,
} from "../../functions/src/cbam/report/instrumentation-derivation";
import { assessUncertainty } from "../../functions/src/dossier/40-readiness/uncertainty";

/** Parses the fixture and hydrates evidence fileHash/sizeBytes from real deterministic PDF bytes. */
async function hydratedCase(key: "STEEL_IN" | "CEMENT_EG" | "ALU_CN" | "FERTILISER_TR") {
  const raw = createFourDossierCase(key);
  await buildFourDossierEvidenceFiles(raw);
  return AuditReadyCaseSchema.parse(raw);
}

describe("instrumentation derivation (seal honesty)", () => {
  it("derives source streams from the case's own activity data", async () => {
    const caseData = await hydratedCase("STEEL_IN");
    const { sourceStreams } = deriveInstrumentation(caseData);

    const names = sourceStreams.map((s) => s.name);
    expect(names).toContain("Installation direct emissions (combustion and process)");
    expect(names).toContain("Electricity import at site boundary");
    expect(names).toContain("Grid emission factor basis");
    for (const precursor of caseData.precursors) {
      expect(names.some((n) => n.includes(String(precursor.name.value)))).toBe(true);
    }
    expect(sourceStreams.length).toBe(3 + caseData.precursors.length);
  });

  it("never fabricates TEST-* instrument identifiers", async () => {
    for (const key of ["STEEL_IN", "CEMENT_EG", "ALU_CN", "FERTILISER_TR"] as const) {
      const caseData = await hydratedCase(key);
      const { sourceStreams, meters, emissionSources } = deriveInstrumentation(caseData);
      const allIdentifiers = [
        ...sourceStreams.map((s) => String(s.instrumentId || "")),
        ...meters.map((m) => m.id),
        ...emissionSources.map((e) => e.name),
      ];
      const joined = allIdentifiers.join(" ");
      expect(joined.toUpperCase()).not.toContain("TEST-");
      expect(joined.toUpperCase()).not.toContain("TEST_METER");
    }
  });

  it("derives meters only from approved calibration certificates", async () => {
    const caseData = await hydratedCase("CEMENT_EG");
    const calibration = calibrationCertificatesOf(caseData);
    expect(calibration.length).toBeGreaterThan(0);

    const { meters } = deriveInstrumentation(caseData);
    expect(meters.length).toBe(calibration.length);
    for (const meter of meters) {
      expect(meter.evidenceId).toBe(calibration.find((c) => c.evidenceId === meter.evidenceId)?.evidenceId);
      expect(meter.id).toBe(meterIdForCertificate(meter.evidenceId));
      expect(meter.id).toMatch(/^MTR-[0-9A-F]{8}$/);
    }
  });

  it("links a calibration certificate only to streams it explicitly covers", async () => {
    const caseData = await hydratedCase("ALU_CN");
    const { sourceStreams } = deriveInstrumentation(caseData);

    const direct = sourceStreams.find((s) => s.name.startsWith("Installation direct"));
    const electricity = sourceStreams.find((s) => s.name.startsWith("Electricity import"));
    const directCert = direct?.calibrationEvidenceId;
    expect(directCert).toBeTruthy();
    // The calibration fixture certificate is linked to directEmissions only.
    const cert = caseData.evidenceRegister.find((e) => e.evidenceId === directCert);
    expect(cert?.linkedInputs).toContain("directEmissions");
    // A stream not covered by any certificate must not be granted one.
    expect(electricity?.calibrationEvidenceId).toBeNull();
    expect(sourceStreams.filter((s) => s.calibrationEvidenceId).every((s) =>
      cert?.linkedInputs.some((path) => s.name.startsWith(path === "directEmissions" ? "Installation direct" : "never"))
    )).toBe(true);
  });

  it("fails closed when no calibration certificate exists", async () => {
    const base = await hydratedCase("STEEL_IN");
    const caseData = AuditReadyCaseSchema.parse({
      ...base,
      evidenceRegister: base.evidenceRegister.filter((e) => !String(e.documentType).toUpperCase().includes("CALIBRATION")),
    });
    const { sourceStreams, meters, calibrationEvidenceId } = deriveInstrumentation(caseData);
    expect(meters.length).toBe(0);
    expect(calibrationEvidenceId).toBe("");
    expect(sourceStreams.every((s) => s.instrumentId === null)).toBe(true);

    const uncertainty = assessUncertainty({
      sourceStreamCount: sourceStreams.length,
      streamsWithInstrument: sourceStreams.filter((s) => Boolean(s.instrumentId)).length,
      streamsWithCalibrationEvidence: sourceStreams.filter((s) => Boolean(s.calibrationEvidenceId)).length,
    });
    expect(uncertainty.state).toBe("NOT_ASSESSED");
    expect(uncertainty.chapterRenderable).toBe(false);
  });

  it("recognises METER_CALIBRATION_CERTIFICATE document types (not only CALIBRATION_CERTIFICATE)", async () => {
    const caseData = await hydratedCase("FERTILISER_TR");
    const calibration = calibrationCertificatesOf(caseData);
    expect(calibration.length).toBeGreaterThan(0);
    expect(calibration.every((c) => String(c.documentType).toUpperCase().includes("CALIBRATION"))).toBe(true);
  });

  it("derives emission sources from the production route", async () => {
    const caseData = await hydratedCase("STEEL_IN");
    const { emissionSources } = deriveInstrumentation(caseData);
    expect(emissionSources.length).toBeGreaterThan(0);
    expect(emissionSources[0].name.toLowerCase()).toContain(String(caseData.installation.productionRoute.value).toLowerCase().slice(0, 8));
  });
});
