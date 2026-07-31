/**
 * Honest instrumentation derivation (FAZ P0 ISS-03/ISS-06).
 *
 * The sealed dossier must never fabricate meter identifiers or uncertainty
 * values. Source streams are derived from the case's own activity data and the
 * meter register is derived from approved, supported, malware-clean
 * calibration certificates in the evidence register. A case without
 * calibration evidence simply has no declared instruments and the uncertainty
 * chapter fails closed.
 *
 * This module is pure (no Firestore, no logging) so the derivation is
 * unit-testable and identical across environments.
 */
import type { AuditReadyCase } from "../schema";

export interface DerivedSourceStream {
  name: string;
  category: "MAJOR" | "MINOR";
  instrumentId: string | null;
  calibrationEvidenceId: string | null;
  calibrationDate: string | null;
  calibrationValidityEnd: string | null;
  maximumPermissibleUncertaintyPercent: string;
  achievedUncertaintyPercent: string;
  appliedTier: string;
}

export interface DerivedMeter {
  id: string;
  calibrationValidity: string;
  evidenceId: string;
}

export interface DerivedEmissionSource {
  name: string;
  gas: "CO2";
}

export interface InstrumentationDerivation {
  calibrationCertificates: AuditReadyCase["evidenceRegister"];
  calibrationEvidenceId: string;
  sourceStreams: DerivedSourceStream[];
  meters: DerivedMeter[];
  emissionSources: DerivedEmissionSource[];
}

/** Approved calibration certificates that count towards the meter register. */
export function calibrationCertificatesOf(caseData: AuditReadyCase): AuditReadyCase["evidenceRegister"] {
  return (caseData.evidenceRegister || []).filter(
    (e) =>
      String(e.documentType || "").toUpperCase().includes("CALIBRATION") &&
      e.reviewStatus === "APPROVED" &&
      e.supportStatus === "SUPPORTED" &&
      e.malwareScanStatus === "CLEAN"
  );
}

/** Deterministic meter identifier derived from the certificate evidence id. */
export function meterIdForCertificate(evidenceId: string): string {
  return `MTR-${String(evidenceId).slice(0, 8).toUpperCase()}`;
}

export function deriveInstrumentation(caseData: AuditReadyCase): InstrumentationDerivation {
  const calibrationCertificates = calibrationCertificatesOf(caseData);
  const primaryCalibration = calibrationCertificates[0];
  const calibrationEvidenceId = primaryCalibration?.evidenceId || "";

  const certificateFor = (linkedPaths: readonly string[]): AuditReadyCase["evidenceRegister"][number] | undefined =>
    calibrationCertificates.find((cert) =>
      (cert.linkedInputs || []).some((path) => linkedPaths.includes(path))
    );

  const instrumentIdFor = (linkedPaths: readonly string[]): string | null => {
    const covered = certificateFor(linkedPaths);
    return covered ? meterIdForCertificate(covered.evidenceId) : null;
  };

  const calibrationScopeFor = (linkedPaths: readonly string[]): string | null =>
    certificateFor(linkedPaths)?.evidenceId || null;

  const calibrationMeta = (linkedPaths: readonly string[]) => {
    const covered = certificateFor(linkedPaths) || primaryCalibration;
    return {
      calibrationDate: covered?.issueDate || null,
      calibrationValidityEnd: covered?.evidencePeriodEnd || null,
    };
  };

  const streamBase = {
    maximumPermissibleUncertaintyPercent: "Declared in monitoring plan",
    achievedUncertaintyPercent: "Declared in monitoring plan",
    appliedTier: "2",
  };

  const sourceStreams: DerivedSourceStream[] = [
    {
      name: "Installation direct emissions (combustion and process)",
      category: "MAJOR",
      instrumentId: instrumentIdFor(["directEmissions"]),
      calibrationEvidenceId: calibrationScopeFor(["directEmissions"]),
      ...calibrationMeta(["directEmissions"]),
      ...streamBase,
    },
    {
      name: "Electricity import at site boundary",
      category: "MAJOR",
      instrumentId: instrumentIdFor(["electricityConsumed"]),
      calibrationEvidenceId: calibrationScopeFor(["electricityConsumed"]),
      ...calibrationMeta(["electricityConsumed"]),
      ...streamBase,
    },
    {
      name: "Grid emission factor basis",
      category: "MAJOR",
      instrumentId: instrumentIdFor(["gridEmissionFactor"]),
      calibrationEvidenceId: calibrationScopeFor(["gridEmissionFactor"]),
      ...calibrationMeta(["gridEmissionFactor"]),
      ...streamBase,
    },
    ...(caseData.precursors || []).map((precursor, index) => {
      const paths = [`precursors.${index}.quantity`, `precursors.${index}.directEmissions`];
      return {
        name: `Precursor material stream: ${String(precursor.name?.value || `precursor ${index + 1}`)}`,
        category: (index === 0 ? "MAJOR" : "MINOR") as "MAJOR" | "MINOR",
        instrumentId: instrumentIdFor(paths),
        calibrationEvidenceId: calibrationScopeFor(paths),
        ...calibrationMeta(paths),
        ...streamBase,
      };
    }),
  ];

  const meters: DerivedMeter[] = calibrationCertificates.map((cert) => ({
    id: meterIdForCertificate(cert.evidenceId),
    calibrationValidity: cert.evidencePeriodEnd || "DECLARED_ON_CASE",
    evidenceId: cert.evidenceId,
  }));

  const route = String(caseData.installation?.productionRoute?.value || "").trim();
  const emissionSources: DerivedEmissionSource[] = [
    {
      name: route ? `Installation process emissions (${route})` : "Installation direct process emissions",
      gas: "CO2",
    },
    { name: "Combustion source streams", gas: "CO2" },
  ];

  return {
    calibrationCertificates,
    calibrationEvidenceId,
    sourceStreams,
    meters,
    emissionSources,
  };
}
