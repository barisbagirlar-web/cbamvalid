import type { AuditReadyCase } from "../schema";
import { runEvidenceSufficiency, isEvidenceSupportedState } from "../validation/evidence-sufficiency";
import { evidenceRequirementFor } from "../report/v6/evidence-gap";

/**
 * Registry Verification Template Mapping Dataset (FAZ 12).
 *
 * The European Commission has not published an official machine-readable
 * Registry submission schema. CBAMValid therefore ships a field-mapped
 * "Registry Verification Template Mapping Dataset" — never an "Official
 * Registry XML" — covering the Commission Registry template fields.
 */
export const REGISTRY_TEMPLATE_MAPPING_DATASET_NAME = "Registry Verification Template Mapping Dataset";

export const RegistryTemplateMappingFieldStatus = {
  COMPLETE_OPERATOR: "COMPLETE_OPERATOR",
  INCOMPLETE_EVIDENCE_MISSING: "INCOMPLETE_EVIDENCE_MISSING",
  PENDING_VERIFIER: "PENDING_VERIFIER",
  MISSING_OPERATOR: "MISSING_OPERATOR",
  NOT_APPLICABLE_WITH_BASIS: "NOT_APPLICABLE_WITH_BASIS",
} as const;
export type RegistryTemplateMappingFieldStatus =
  (typeof RegistryTemplateMappingFieldStatus)[keyof typeof RegistryTemplateMappingFieldStatus];

export interface RegistryTemplateFieldMapping {
  readonly registryFieldId: string;
  readonly section: string;
  readonly legalBasis: string;
  readonly sourcePath: string;
  readonly value: string;
  readonly status: RegistryTemplateMappingFieldStatus;
  readonly owner: "OPERATOR" | "CBAMVALID_SYSTEM" | "INDEPENDENT_VERIFIER";
  readonly evidenceIds: readonly string[];
  readonly validationErrors: readonly string[];
}

export interface RegistryTemplateMappingDataset {
  readonly datasetName: typeof REGISTRY_TEMPLATE_MAPPING_DATASET_NAME;
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly officialRegistryXml: false;
  readonly fields: readonly RegistryTemplateFieldMapping[];
}

const legalBasis = {
  operatorIdentity: "Regulation (EU) 2023/956 Article 8 and Annex VI.1(a)",
  installationIdentity: "Implementing Regulation (EU) 2025/2546 Article 6 and Annex point 1.1",
  reportingPeriod: "Regulation (EU) 2023/956 Article 8",
  goods: "Regulation (EU) 2023/956 Annex VI.1(c)",
  directEmissions: "Regulation (EU) 2023/956 Annex VI.1(d)",
  electricity: "Implementing Regulation (EU) 2025/2546 Article 6 and Annex point 2.4",
  precursor: "Implementing Regulation (EU) 2025/2546 Article 6 and Annex point 2.5",
  allocation: "Implementing Regulation (EU) 2025/2546 Article 6 and Annex point 2.4",
  carbonPrice: "Regulation (EU) 2023/956 Article 9 and Annex VI.2",
  verifierIdentity: "Regulation (EU) 2023/956 Annex VI.2",
  siteVisit: "Implementing Regulation (EU) 2025/2546 Articles 2 to 4 and Annex point 2.2",
  opinion: "Regulation (EU) 2023/956 Annex VI.4",
} as const;

function present(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function field(
  registryFieldId: string,
  section: string,
  legalBasisText: string,
  sourcePath: string,
  value: string,
  owner: RegistryTemplateFieldMapping["owner"],
  evidenceIds: readonly string[],
  validationErrors: readonly string[]
): RegistryTemplateFieldMapping {
  let status: RegistryTemplateMappingFieldStatus;
  if (owner === "INDEPENDENT_VERIFIER") {
    status = present(value) ? RegistryTemplateMappingFieldStatus.COMPLETE_OPERATOR : RegistryTemplateMappingFieldStatus.PENDING_VERIFIER;
  } else if (sourcePath.startsWith("N/A")) {
    status = RegistryTemplateMappingFieldStatus.NOT_APPLICABLE_WITH_BASIS;
  } else if (present(value)) {
    status = RegistryTemplateMappingFieldStatus.COMPLETE_OPERATOR;
  } else {
    status = RegistryTemplateMappingFieldStatus.MISSING_OPERATOR;
  }
  return { registryFieldId, section, legalBasis: legalBasisText, sourcePath, value, status, owner, evidenceIds, validationErrors };
}

export function buildRegistryTemplateMapping(caseData: AuditReadyCase, assessmentTimestamp?: string): RegistryTemplateFieldMapping[] {
  const sufficiency = runEvidenceSufficiency(caseData, assessmentTimestamp);
  const evidenceIdsFor = (requirementId: string): readonly string[] => {
    const row = sufficiency.find((item) => item.requirementId === requirementId);
    return row?.evidenceIds ?? [];
  };
  const validationErrorsFor = (requirementId: string): readonly string[] => {
    const row = sufficiency.find((item) => item.requirementId === requirementId);
    if (!row) return ["REQUIREMENT_NOT_EVALUATED"];
    if (isEvidenceSupportedState(row.state)) return [];
    return row.reasonCodes;
  };

  const fields: RegistryTemplateFieldMapping[] = [];

  const operator = caseData.exporterIdentity;
  fields.push(
    field("REG-OP-LEGAL-NAME", "Operator", legalBasis.operatorIdentity, "exporterIdentity.legalName.value", String(operator.legalName.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-OP-NAME"), validationErrorsFor("REQ-OP-NAME")),
    field("REG-OP-REG-NO", "Operator", legalBasis.operatorIdentity, "exporterIdentity.registrationNumber.value", String(operator.registrationNumber?.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-OP-NAME"), []),
    field("REG-OP-ADDRESS", "Operator", legalBasis.operatorIdentity, "exporterIdentity.address.value", String(operator.address?.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-OP-NAME"), []),
    field("REG-OP-COUNTRY", "Operator", legalBasis.operatorIdentity, "exporterIdentity.exporterCountry.value", String(operator.exporterCountry?.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-OP-NAME"), []),
    field("REG-OP-CONTACT-EMAIL", "Operator", legalBasis.operatorIdentity, "exporterIdentity.contactEmail.value", String(operator.contactEmail?.value ?? ""), "OPERATOR", [], [])
  );

  const installation = caseData.installation;
  fields.push(
    field("REG-INST-NAME", "Installation", legalBasis.installationIdentity, "installation.name.value", String(installation.name.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-INST-NAME"), validationErrorsFor("REQ-INST-NAME")),
    field("REG-INST-REGISTRY-ID", "Installation", legalBasis.installationIdentity, "installation.registryInstallationId.value", String(installation.registryInstallationId?.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-INST-NAME"), []),
    field("REG-INST-UNLOCODE", "Installation", legalBasis.installationIdentity, "installation.unloCode.value", String(installation.unloCode?.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-INST-NAME"), []),
    field("REG-INST-ADDRESS", "Installation", legalBasis.installationIdentity, "installation.address.value", String(installation.address?.value ?? ""), "OPERATOR", [], []),
    field("REG-INST-LATITUDE", "Installation", legalBasis.installationIdentity, "installation.latitude.value", String(installation.latitude?.value ?? ""), "OPERATOR", [], []),
    field("REG-INST-LONGITUDE", "Installation", legalBasis.installationIdentity, "installation.longitude.value", String(installation.longitude?.value ?? ""), "OPERATOR", [], []),
    field("REG-INST-COUNTRY", "Installation", legalBasis.installationIdentity, "installation.country.value", String(installation.country.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-INST-NAME"), []),
    field("REG-INST-PRODUCTION-ROUTE", "Installation", legalBasis.installationIdentity, "installation.productionRoute.value", String(installation.productionRoute.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-INST-NAME"), []),
    field("REG-INST-SYSTEM-BOUNDARY", "Installation", legalBasis.installationIdentity, "installation.systemBoundaries", installation.systemBoundaries ?? "", "OPERATOR", evidenceIdsFor("REQ-INST-BOUNDS"), []),
    field("REG-INST-EXCLUDED-PROCESSES", "Installation", legalBasis.installationIdentity, "installation.excludedProcesses", installation.excludedProcesses ?? "", "OPERATOR", [], []),
    field("REG-INST-MONITORING-PLAN", "Installation", legalBasis.installationIdentity, "installation.monitoringPlanId.value", String(installation.monitoringPlanId?.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-INST-BOUNDS"), [])
  );

  fields.push(
    field("REG-PERIOD-YEAR", "Reporting period", legalBasis.reportingPeriod, "reportingPeriod.year.value", String(caseData.reportingPeriod.year.value ?? ""), "CBAMVALID_SYSTEM", evidenceIdsFor("REQ-PERIOD-YEAR"), []),
    field("REG-PERIOD-START", "Reporting period", legalBasis.reportingPeriod, "reportingPeriod.startDate.value", String(caseData.reportingPeriod.startDate?.value ?? ""), "CBAMVALID_SYSTEM", evidenceIdsFor("REQ-PERIOD-YEAR"), []),
    field("REG-PERIOD-END", "Reporting period", legalBasis.reportingPeriod, "reportingPeriod.endDate.value", String(caseData.reportingPeriod.endDate?.value ?? ""), "CBAMVALID_SYSTEM", evidenceIdsFor("REQ-PERIOD-YEAR"), [])
  );

  caseData.goods.forEach((good, index) => {
    fields.push(
      field(`REG-GOOD-CN-${index}`, "Goods", legalBasis.goods, `goods.${index}.cnCode.value`, String(good.cnCode.value ?? ""), "OPERATOR", evidenceIdsFor(`REQ-GOOD-CN-${index}`), validationErrorsFor(`REQ-GOOD-CN-${index}`)),
      field(`REG-GOOD-PROD-${index}`, "Goods", legalBasis.goods, `goods.${index}.productionVolume.value`, String(good.productionVolume.value ?? ""), "OPERATOR", evidenceIdsFor(`REQ-GOOD-VOL-${index}`), validationErrorsFor(`REQ-GOOD-VOL-${index}`)),
      field(
        `REG-GOOD-ALLOC-${index}`,
        "Goods",
        legalBasis.allocation,
        caseData.goods.length <= 1
          ? "N/A - single good; allocation share is 100% and allocation evidence is not required"
          : `goods.${index}.allocationShare.value`,
        String(good.allocationShare?.value ?? ""),
        "OPERATOR",
        evidenceIdsFor(`REQ-GOOD-ALLOC-${index}`),
        []
      )
    );
  });

  fields.push(
    field("REG-DIRECT-EM", "Emissions", legalBasis.directEmissions, "directEmissions.value", String(caseData.directEmissions.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-DIR-EM"), validationErrorsFor("REQ-DIR-EM")),
    field("REG-ELECTRICITY", "Emissions", legalBasis.electricity, "electricityConsumed.value", String(caseData.electricityConsumed.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-ELEC-CON"), validationErrorsFor("REQ-ELEC-CON")),
    field("REG-GRID-FACTOR", "Emissions", legalBasis.electricity, "gridEmissionFactor.value", String(caseData.gridEmissionFactor.value ?? ""), "OPERATOR", evidenceIdsFor("REQ-ELEC-FAC"), validationErrorsFor("REQ-ELEC-FAC"))
  );

  if (caseData.precursors.length === 0) {
    fields.push(field("REG-PRECURSORS", "Precursors", legalBasis.precursor, "N/A - no precursors declared", "", "OPERATOR", [], ["NOT_APPLICABLE_WITH_BASIS"]));
  } else {
    caseData.precursors.forEach((precursor, index) => {
      fields.push(
        field(`REG-PREC-QTY-${index}`, "Precursors", legalBasis.precursor, `precursors.${index}.quantity.value`, String(precursor.quantity.value ?? ""), "OPERATOR", evidenceIdsFor(`REQ-PRE-QTY-${index}`), validationErrorsFor(`REQ-PRE-QTY-${index}`)),
        field(`REG-PREC-COUNTRY-${index}`, "Precursors", legalBasis.precursor, `precursors.${index}.countryOfOrigin.value`, String(precursor.countryOfOrigin.value ?? ""), "OPERATOR", evidenceIdsFor(`REQ-PRE-QTY-${index}`), []),
        field(`REG-PREC-DIRECT-${index}`, "Precursors", legalBasis.precursor, `precursors.${index}.directEmissions.value`, String(precursor.directEmissions.value ?? ""), "OPERATOR", evidenceIdsFor(`REQ-PRE-QTY-${index}`), []),
        field(`REG-PREC-INDIRECT-${index}`, "Precursors", legalBasis.precursor, `precursors.${index}.indirectEmissions.value`, String(precursor.indirectEmissions.value ?? ""), "OPERATOR", evidenceIdsFor(`REQ-PRE-QTY-${index}`), [])
      );
    });
  }

  fields.push(
    field("REG-ALLOC-METHOD", "Allocation", legalBasis.allocation, caseData.goods.length <= 1 ? "N/A - single good; no allocation between multiple goods is performed" : "methodologyDecisions.allocationMethod", caseData.methodologyDecisions.find((item) => item.topic.toLowerCase().includes("llocat"))?.selectedMethod ?? "", "OPERATOR", evidenceIdsFor("REQ-GOOD-ALLOC-0"), [])
  );

  if (caseData.carbonPriceRecords.length === 0) {
    fields.push(field("REG-CARBON-PRICE", "Carbon price", legalBasis.carbonPrice, "N/A - no carbon price paid", "", "OPERATOR", [], ["NOT_APPLICABLE_WITH_BASIS"]));
  } else {
    caseData.carbonPriceRecords.forEach((record, index) => {
      fields.push(
        field(`REG-CARBON-PRICE-${index}`, "Carbon price", legalBasis.carbonPrice, `carbonPriceRecords.${index}.amountPaid`, String(record.amountPaid), "OPERATOR", [record.proofOfPaymentEvidenceId, record.independentCertificationEvidenceId].filter((item): item is string => typeof item === "string" && item.length > 0), [])
      );
    });
  }

  const verifier = caseData.verifierReserved;
  const pendingVerifier = (registryFieldId: string, sourcePath: string, value: string | undefined): RegistryTemplateFieldMapping =>
    field(registryFieldId, "Verifier", legalBasis.verifierIdentity, sourcePath, value ?? "", "INDEPENDENT_VERIFIER", [], []);
  fields.push(
    pendingVerifier("REG-VER-NAME", "verifierReserved.verifierLegalName", verifier?.verifierLegalName),
    pendingVerifier("REG-VER-ACC-NO", "verifierReserved.accreditationNumber", verifier?.accreditationNumber),
    pendingVerifier("REG-VER-NAB", "verifierReserved.nationalAccreditationBody", verifier?.nationalAccreditationBody),
    pendingVerifier("REG-VER-ACC-COUNTRY", "verifierReserved.accreditationCountry", verifier?.accreditationCountry),
    pendingVerifier("REG-VER-ACC-EXPIRY", "verifierReserved.accreditationExpiry", verifier?.accreditationExpiry),
    pendingVerifier("REG-VER-ACC-SCOPE", "verifierReserved.accreditationScope", verifier?.accreditationScope),
    field("REG-VER-SITE-VISIT", "Verifier", legalBasis.siteVisit, "verifierReserved.siteVisitType", verifier?.siteVisitType ?? "", "INDEPENDENT_VERIFIER", [], []),
    field("REG-VER-VISIT-DATES", "Verifier", legalBasis.siteVisit, "verifierReserved.siteVisitDates", verifier?.siteVisitDates ?? "", "INDEPENDENT_VERIFIER", [], []),
    field("REG-VER-OPINION", "Verifier", legalBasis.opinion, "verifierReserved.finalOpinion", verifier?.finalOpinion ?? "", "INDEPENDENT_VERIFIER", [], []),
    field("REG-VER-CERT-REF", "Verifier", legalBasis.opinion, "verifierReserved.certificateReference", verifier?.certificateReference ?? "", "INDEPENDENT_VERIFIER", [], [])
  );

  // G-08 / INV-05: a MANDATORY field with a present value but no linked
  // evidence can never be reported COMPLETE_OPERATOR. It is reclassified to
  // INCOMPLETE_EVIDENCE_MISSING so the evidence-gap gate counts it and the
  // consumer never mistakes "value present" for "evidence complete". This
  // applies to every owner: CBAMVALID_SYSTEM-derived period fields are covered
  // by period-basis evidence and are just as gated as operator fields.
  for (let index = 0; index < fields.length; index += 1) {
    const entry = fields[index]!;
    if (
      entry.status === RegistryTemplateMappingFieldStatus.COMPLETE_OPERATOR &&
      evidenceRequirementFor(entry.registryFieldId, entry.sourcePath) === "MANDATORY" &&
      entry.evidenceIds.length === 0
    ) {
      fields[index] = { ...entry, status: RegistryTemplateMappingFieldStatus.INCOMPLETE_EVIDENCE_MISSING };
    }
  }

  return fields;
}

export function buildRegistryTemplateMappingDataset(caseData: AuditReadyCase, assessmentTimestamp?: string): RegistryTemplateMappingDataset {
  return {
    datasetName: REGISTRY_TEMPLATE_MAPPING_DATASET_NAME,
    schemaVersion: "REGISTRY-TEMPLATE-MAPPING-1.0",
    generatedAt: assessmentTimestamp ?? new Date().toISOString(),
    officialRegistryXml: false,
    fields: buildRegistryTemplateMapping(caseData, assessmentTimestamp),
  };
}

/**
 * CBAM Registry Submission Preparation XML (definitive-period aligned).
 *
 * The Commission publishes its transitional-period XSD (QReport_ver23.00.xsd)
 * and has not yet published a definitive-period machine-readable submission
 * schema. CBAMValid therefore emits a *preparation* XML whose element set
 * mirrors the registry report structure (header, operator, installation,
 * reporting period, goods, emissions, allocation, carbon price, verifier)
 * using the same field identifiers as the Registry Template Mapping Dataset.
 * It is explicitly NOT an official EU CBAM Registry submission file and must
 * never be described as one — the declarant remains responsible for any
 * Registry submission derived from it.
 */
export function buildRegistrySubmissionPreparationXml(caseData: AuditReadyCase, assessmentTimestamp?: string): string {
  const dataset = buildRegistryTemplateMappingDataset(caseData, assessmentTimestamp);

  const escape = (value: string): string =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");

  const sectionOrder = ["Operator", "Installation", "Reporting period", "Goods", "Emissions", "Precursors", "Allocation", "Carbon price", "Verifier"];
  const sections = sectionOrder
    .map((section) => {
      const rows = dataset.fields.filter((field) => field.section === section);
      if (rows.length === 0) return "";
      const items = rows
        .map(
          (field) =>
            `    <Field registryFieldId="${escape(field.registryFieldId)}" section="${escape(field.section)}" owner="${escape(field.owner)}" status="${escape(field.status)}">` +
            `<LegalBasis>${escape(field.legalBasis)}</LegalBasis>` +
            `<SourcePath>${escape(field.sourcePath)}</SourcePath>` +
            `<Value>${escape(field.value)}</Value>` +
            (field.validationErrors.length > 0
              ? `<ValidationErrors>${field.validationErrors.map((item) => `<Error>${escape(item)}</Error>`).join("")}</ValidationErrors>`
              : "") +
            `</Field>`
        )
        .join("\n");
      return `  <Section name="${escape(section)}">\n${items}\n  </Section>`;
    })
    .filter((section) => section.length > 0)
    .join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<CBAMRegistrySubmissionPreparation xmlns="urn:cbamvalid:registry:preparation:v1" generatedAt="${escape(dataset.generatedAt)}">`,
    `  <Disclaimer>This XML is a preparation export generated by the CBAMValid system. It is not an official European Commission CBAM Registry submission file. The authorised CBAM declarant remains legally responsible for any submission derived from it. The Commission has not published a definitive-period machine-readable submission schema; this export mirrors the registry report field structure for data-transfer convenience.</Disclaimer>`,
    `  <Dataset>`,
    `    <DatasetName>${escape(dataset.datasetName)}</DatasetName>`,
    `    <SchemaVersion>${escape(dataset.schemaVersion)}</SchemaVersion>`,
    `    <OfficialRegistryXml>false</OfficialRegistryXml>`,
    `  </Dataset>`,
    sections,
    `</CBAMRegistrySubmissionPreparation>`,
    "",
  ].join("\n");
}
