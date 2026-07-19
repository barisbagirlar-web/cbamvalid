import type { AuditReadyCase } from "../schema";
import type { VerificationRequirementCrosswalkRow } from "../report/premium-dossier-schema";
import { runEvidenceSufficiency } from "../validation/evidence-sufficiency";

export function buildVerificationCrosswalk(caseData: AuditReadyCase): VerificationRequirementCrosswalkRow[] {
  const sufficiency = runEvidenceSufficiency(caseData);
  const rows: VerificationRequirementCrosswalkRow[] = [];

  const getStatusFromSufficiency = (reqId: string): { status: VerificationRequirementCrosswalkRow["status"]; evidenceIds: string[] } => {
    const row = sufficiency.find(r => r.requirementId === reqId);
    if (!row) return { status: "MISSING", evidenceIds: [] };
    if (row.state === "SUPPORTED") return { status: "COMPLETE", evidenceIds: row.evidenceIds };
    if (row.state === "PARTIALLY_SUPPORTED") return { status: "PARTIAL", evidenceIds: row.evidenceIds };
    return { status: "MISSING", evidenceIds: row.evidenceIds };
  };

  // 1. Operator Name & Address
  const opName = getStatusFromSufficiency("REQ-OP-NAME");
  rows.push({
    requirementId: "CW-OP-NAME",
    legalSourceId: "REG_2023_956",
    legalLocation: "Article 8 & Annex VI.1(a)",
    requirementText: "Operator Name and Registration Address",
    owner: "OPERATOR",
    reportSectionIds: ["SEC_04"],
    inputPaths: ["exporterIdentity.legalName", "exporterIdentity.address"],
    evidenceIds: opName.evidenceIds,
    calculationIds: [],
    status: opName.status,
    reasonCodes: opName.status === "COMPLETE" ? ["PASS"] : ["EVIDENCE_GAP"],
  });

  // 2. Installation details
  const instName = getStatusFromSufficiency("REQ-INST-NAME");
  rows.push({
    requirementId: "CW-INST-INFO",
    legalSourceId: "IMPL_2025_2546",
    legalLocation: "Article 6 & Annex",
    requirementText: "Installation Name, address and UN/LOCODE coordinates",
    owner: "OPERATOR",
    reportSectionIds: ["SEC_04"],
    inputPaths: ["installation.name", "installation.country", "installation.unloCode"],
    evidenceIds: instName.evidenceIds,
    calculationIds: [],
    status: instName.status,
    reasonCodes: instName.status === "COMPLETE" ? ["PASS"] : ["EVIDENCE_GAP"],
  });

  // 3. Report ID and period
  rows.push({
    requirementId: "CW-REP-PERIOD",
    legalSourceId: "REG_2023_956",
    legalLocation: "Article 8",
    requirementText: "Report ID and Reporting period",
    owner: "CBAMVALID_SYSTEM",
    reportSectionIds: ["SEC_01", "SEC_04"],
    inputPaths: ["reportingPeriod.year", "reportingPeriod.quarter"],
    evidenceIds: [],
    calculationIds: [],
    status: "COMPLETE",
    reasonCodes: ["PASS"],
  });

  // 4. Verifier identity (reserved verifier fields)
  rows.push({
    requirementId: "CW-VER-ID",
    legalSourceId: "REG_2023_956",
    legalLocation: "Annex VI.2",
    requirementText: "Verifier identity, address, NAB country, accreditation scope and expiry",
    owner: "INDEPENDENT_VERIFIER",
    reportSectionIds: ["SEC_20", "SEC_24"],
    inputPaths: [],
    evidenceIds: [],
    calculationIds: [],
    status: "PENDING_EXTERNAL_VERIFIER",
    reasonCodes: ["PENDING_EXTERNAL_VERIFIER"],
  });

  // 5. Site visit date or waiver basis
  rows.push({
    requirementId: "CW-VER-VISIT",
    legalSourceId: "IMPL_2025_2546",
    legalLocation: "Article 6(2)",
    requirementText: "Installation physical visit date or legal waiver justification basis",
    owner: "INDEPENDENT_VERIFIER",
    reportSectionIds: ["SEC_20", "SEC_24"],
    inputPaths: [],
    evidenceIds: [],
    calculationIds: [],
    status: "PENDING_EXTERNAL_VERIFIER",
    reasonCodes: ["PENDING_EXTERNAL_VERIFIER"],
  });

  // 6. Goods quantities
  caseData.goods.forEach((good, index) => {
    const vol = getStatusFromSufficiency(`REQ-GOOD-VOL-${index}`);
    rows.push({
      requirementId: `CW-GOOD-QTY-${index}`,
      legalSourceId: "REG_2023_956",
      legalLocation: "Annex VI.1(c)",
      requirementText: `Production quantity and CN-code verification for Good ${index + 1}`,
      owner: "OPERATOR",
      reportSectionIds: ["SEC_05"],
      inputPaths: [`goods.${index}.cnCode`, `goods.${index}.productionVolume`],
      evidenceIds: vol.evidenceIds,
      calculationIds: [],
      status: vol.status,
      reasonCodes: vol.status === "COMPLETE" ? ["PASS"] : ["EVIDENCE_GAP"],
    });
  });

  // 7. Direct emissions
  const dirEm = getStatusFromSufficiency("REQ-DIR-EM");
  rows.push({
    requirementId: "CW-DIR-EM",
    legalSourceId: "REG_2023_956",
    legalLocation: "Annex VI.1(d)",
    requirementText: "Installation direct emissions monitoring plan data and methodology",
    owner: "OPERATOR",
    reportSectionIds: ["SEC_08"],
    inputPaths: ["directEmissions"],
    evidenceIds: dirEm.evidenceIds,
    calculationIds: [],
    status: dirEm.status,
    reasonCodes: dirEm.status === "COMPLETE" ? ["PASS"] : ["EVIDENCE_GAP"],
  });

  // 8. Attribution/allocation method
  rows.push({
    requirementId: "CW-ALLOC-METHOD",
    legalSourceId: "IMPL_2025_2546",
    legalLocation: "Annex II",
    requirementText: "Emissions attribution methodology and allocation share factors",
    owner: "OPERATOR",
    reportSectionIds: ["SEC_11"],
    inputPaths: caseData.goods.map((_, index) => `goods.${index}.allocationShare`),
    evidenceIds: [],
    calculationIds: [],
    status: caseData.goods.length <= 1 ? "COMPLETE" : getStatusFromSufficiency("REQ-GOOD-ALLOC-0").status,
    reasonCodes: ["PASS"],
  });

  // 9. Non-associated flows
  rows.push({
    requirementId: "CW-NON-ASSOC",
    legalSourceId: "IMPL_2025_2546",
    legalLocation: "Annex II.3",
    requirementText: "Identification of non-associated goods/emissions/energy flows",
    owner: "OPERATOR",
    reportSectionIds: ["SEC_12"],
    inputPaths: [],
    evidenceIds: [],
    calculationIds: [],
    status: "COMPLETE",
    reasonCodes: ["PASS"],
  });

  // 10. Precursor quantities and emissions
  caseData.precursors.forEach((precursor, index) => {
    const qty = getStatusFromSufficiency(`REQ-PRE-QTY-${index}`);
    rows.push({
      requirementId: `CW-PRECURSOR-${index}`,
      legalSourceId: "IMPL_2025_2546",
      legalLocation: "Annex II.4",
      requirementText: `Quantity and specific embedded emissions for precursor ${index + 1} (${precursor.name.value})`,
      owner: "OPERATOR",
      reportSectionIds: ["SEC_10"],
      inputPaths: [`precursors.${index}.quantity`, `precursors.${index}.directEmissions`, `precursors.${index}.indirectEmissions`],
      evidenceIds: qty.evidenceIds,
      calculationIds: [],
      status: qty.status,
      reasonCodes: qty.status === "COMPLETE" ? ["PASS"] : ["EVIDENCE_GAP"],
    });
  });

  // 11. Precursor-producing installation identity
  rows.push({
    requirementId: "CW-PRECURSOR-INST",
    legalSourceId: "IMPL_2025_2546",
    legalLocation: "Annex II.4.1",
    requirementText: "Precursor-producing installation identity, country and registration when actual emissions are used",
    owner: "OPERATOR",
    reportSectionIds: ["SEC_10"],
    inputPaths: caseData.precursors.map((_, index) => `precursors.${index}.countryOfOrigin`),
    evidenceIds: [],
    calculationIds: [],
    status: caseData.precursors.length === 0 ? "NOT_APPLICABLE" : "COMPLETE",
    reasonCodes: ["PASS"],
  });

  // 12. Material misstatements corrected
  rows.push({
    requirementId: "CW-VER-MISSTATEMENTS",
    legalSourceId: "REG_2023_956",
    legalLocation: "Annex VI.3",
    requirementText: "Verifier audit trace of material misstatements detected and corrected during verification",
    owner: "INDEPENDENT_VERIFIER",
    reportSectionIds: ["SEC_15", "SEC_18"],
    inputPaths: [],
    evidenceIds: [],
    calculationIds: [],
    status: "PENDING_EXTERNAL_VERIFIER",
    reasonCodes: ["PENDING_EXTERNAL_VERIFIER"],
  });

  // 13. Material non-conformities corrected
  rows.push({
    requirementId: "CW-VER-NONCONFORMITIES",
    legalSourceId: "REG_2023_956",
    legalLocation: "Annex VI.3",
    requirementText: "Verifier audit trace of non-conformities with monitoring rules detected and corrected",
    owner: "INDEPENDENT_VERIFIER",
    reportSectionIds: ["SEC_15", "SEC_19"],
    inputPaths: [],
    evidenceIds: [],
    calculationIds: [],
    status: "PENDING_EXTERNAL_VERIFIER",
    reasonCodes: ["PENDING_EXTERNAL_VERIFIER"],
  });

  // 14. Verifier reasonable-assurance statement
  rows.push({
    requirementId: "CW-VER-OPINION",
    legalSourceId: "REG_2023_956",
    legalLocation: "Annex VI.4",
    requirementText: "Verifier final reasonable-assurance opinion statement and sign-off",
    owner: "INDEPENDENT_VERIFIER",
    reportSectionIds: ["SEC_24"],
    inputPaths: [],
    evidenceIds: [],
    calculationIds: [],
    status: "PENDING_EXTERNAL_VERIFIER",
    reasonCodes: ["PENDING_EXTERNAL_VERIFIER"],
  });

  return rows;
}
