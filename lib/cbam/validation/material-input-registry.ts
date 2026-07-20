import type { AuditReadyCase } from "../schema";
import type { MaterialInputRequirement } from "../premium-dossier-model";

export function deriveMaterialRequirements(caseData: AuditReadyCase): MaterialInputRequirement[] {
  const requirements: MaterialInputRequirement[] = [];

  // 1. Identity & Registration
  requirements.push({
    requirementId: "REQ-OP-NAME",
    inputPath: "exporterIdentity.legalName",
    displayName: "Operator Legal Name",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "text",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-OP-ADDR",
    inputPath: "exporterIdentity.address",
    displayName: "Operator Address",
    responsibleParty: "OPERATOR",
    requirementLevel: "REQUIRED",
    conditionCode: null,
    expectedDimension: "text",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-IM-NAME",
    inputPath: "importerIdentity.legalName",
    displayName: "Importer Legal Name",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "text",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-IM-EORI",
    inputPath: "importerIdentity.eoriNumber",
    displayName: "Importer EORI Number",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "text",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  // 2. Installation Boundary & Period
  requirements.push({
    requirementId: "REQ-INST-NAME",
    inputPath: "installation.name",
    displayName: "Installation Name",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "text",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-INST-COUNTRY",
    inputPath: "installation.country",
    displayName: "Installation Country",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "text",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-INST-ROUTE",
    inputPath: "installation.productionRoute",
    displayName: "Production Route",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "text",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-INST-BOUNDS",
    inputPath: "installation.systemBoundaries",
    displayName: "System Boundaries Description",
    responsibleParty: "OPERATOR",
    requirementLevel: "REQUIRED",
    conditionCode: null,
    expectedDimension: "text",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 0,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-PERIOD-YEAR",
    inputPath: "reportingPeriod.year",
    displayName: "Reporting Period Year",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "number",
    acceptedCanonicalUnits: ["text"],
    reportingPeriodRequired: false,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  // 3. Goods Population
  caseData.goods.forEach((good, index) => {
    requirements.push({
      requirementId: `REQ-GOOD-CN-${index}`,
      inputPath: `goods.${index}.cnCode`,
      displayName: `Good ${index + 1} CN Code`,
      responsibleParty: "OPERATOR",
      requirementLevel: "MATERIAL_REQUIRED",
      conditionCode: null,
      expectedDimension: "text",
      acceptedCanonicalUnits: ["text"],
      reportingPeriodRequired: true,
      minimumEvidenceCount: 1,
      ruleSourceId: "REG_2023_956_ART8",
    });

    requirements.push({
      requirementId: `REQ-GOOD-VOL-${index}`,
      inputPath: `goods.${index}.productionVolume`,
      displayName: `Good ${index + 1} Production Volume`,
      responsibleParty: "OPERATOR",
      requirementLevel: "MATERIAL_REQUIRED",
      conditionCode: null,
      expectedDimension: "mass",
      acceptedCanonicalUnits: ["t", "kg"],
      reportingPeriodRequired: true,
      minimumEvidenceCount: 1,
      ruleSourceId: "REG_2023_956_ART8",
    });

    if (caseData.goods.length > 1) {
      requirements.push({
        requirementId: `REQ-GOOD-ALLOC-${index}`,
        inputPath: `goods.${index}.allocationShare`,
        displayName: `Good ${index + 1} Allocation Share`,
        responsibleParty: "OPERATOR",
        requirementLevel: "CONDITIONAL",
        conditionCode: "MULTIPLE_GOODS",
        expectedDimension: "fraction",
        acceptedCanonicalUnits: ["fraction"],
        reportingPeriodRequired: true,
        minimumEvidenceCount: 1,
        ruleSourceId: "IMPL_2025_2546_ANNEX",
      });
    }
  });

  // 4. Installation Emissions & Energy Data
  requirements.push({
    requirementId: "REQ-DIR-EM",
    inputPath: "directEmissions",
    displayName: "Installation Direct Emissions",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "emissions",
    acceptedCanonicalUnits: ["tCO2e"],
    reportingPeriodRequired: true,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-ELEC-CON",
    inputPath: "electricityConsumed",
    displayName: "Electricity Consumed",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "energy",
    acceptedCanonicalUnits: ["MWh"],
    reportingPeriodRequired: true,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  requirements.push({
    requirementId: "REQ-ELEC-FAC",
    inputPath: "gridEmissionFactor",
    displayName: "Grid Emission Factor",
    responsibleParty: "OPERATOR",
    requirementLevel: "MATERIAL_REQUIRED",
    conditionCode: null,
    expectedDimension: "factor",
    acceptedCanonicalUnits: ["tCO2e/MWh"],
    reportingPeriodRequired: true,
    minimumEvidenceCount: 1,
    ruleSourceId: "IMPL_2025_2546_ART6",
  });

  // 5. Precursor Inputs
  caseData.precursors.forEach((precursor, index) => {
    requirements.push({
      requirementId: `REQ-PRE-NAME-${index}`,
      inputPath: `precursors.${index}.name`,
      displayName: `Precursor ${index + 1} Name`,
      responsibleParty: "OPERATOR",
      requirementLevel: "MATERIAL_REQUIRED",
      conditionCode: null,
      expectedDimension: "text",
      acceptedCanonicalUnits: ["text"],
      reportingPeriodRequired: false,
      minimumEvidenceCount: 1,
      ruleSourceId: "IMPL_2025_2546_ANNEX",
    });

    requirements.push({
      requirementId: `REQ-PRE-QTY-${index}`,
      inputPath: `precursors.${index}.quantity`,
      displayName: `Precursor ${index + 1} Quantity`,
      responsibleParty: "OPERATOR",
      requirementLevel: "MATERIAL_REQUIRED",
      conditionCode: null,
      expectedDimension: "mass",
      acceptedCanonicalUnits: ["t", "kg"],
      reportingPeriodRequired: true,
      minimumEvidenceCount: 1,
      ruleSourceId: "IMPL_2025_2546_ANNEX",
    });

    requirements.push({
      requirementId: `REQ-PRE-DIR-${index}`,
      inputPath: `precursors.${index}.directEmissions`,
      displayName: `Precursor ${index + 1} Direct Emissions`,
      responsibleParty: "OPERATOR",
      requirementLevel: "MATERIAL_REQUIRED",
      conditionCode: null,
      expectedDimension: "emissions",
      acceptedCanonicalUnits: ["tCO2e"],
      reportingPeriodRequired: true,
      minimumEvidenceCount: 1,
      ruleSourceId: "IMPL_2025_2546_ANNEX",
    });

    requirements.push({
      requirementId: `REQ-PRE-IND-${index}`,
      inputPath: `precursors.${index}.indirectEmissions`,
      displayName: `Precursor ${index + 1} Indirect Emissions`,
      responsibleParty: "OPERATOR",
      requirementLevel: "MATERIAL_REQUIRED",
      conditionCode: null,
      expectedDimension: "emissions",
      acceptedCanonicalUnits: ["tCO2e"],
      reportingPeriodRequired: true,
      minimumEvidenceCount: 1,
      ruleSourceId: "IMPL_2025_2546_ANNEX",
    });
  });

  // 6. Carbon Price Records (if any exist)
  caseData.carbonPriceRecords.forEach((record, index) => {
    requirements.push({
      requirementId: `REQ-CP-PAY-${index}`,
      inputPath: `carbonPriceRecords.${index}.proofOfPaymentEvidenceId`,
      displayName: `Carbon Price Payment Proof for Record ${index + 1}`,
      responsibleParty: "OPERATOR",
      requirementLevel: "CONDITIONAL",
      conditionCode: "CARBON_PRICE_DEDUCTION",
      expectedDimension: "evidence",
      acceptedCanonicalUnits: ["text"],
      reportingPeriodRequired: false,
      minimumEvidenceCount: 1,
      ruleSourceId: "REG_2023_956_ART9",
    });
  });

  return requirements;
}
