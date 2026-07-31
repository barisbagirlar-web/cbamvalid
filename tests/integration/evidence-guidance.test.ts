/**
 * FAZ P0 (I) — Field-based guidance and evidence-linking tests.
 *
 * Every material field must expose:
 *   whyRequired, expectedFormat, acceptedEvidenceTypes,
 *   preferredIssuerCategories, example, responsibleParty, relatedStep,
 *   legalBasis, blockingLevel, periodGuidance, gapImpact.
 *
 * Users must see why a field is needed, what format to enter, which documents
 * are accepted, from whom, which period must be covered and how a gap affects
 * the report.
 */

import { describe, expect, it } from "vitest";
import {
  getFieldGuidance,
  getFieldGuidanceForPath,
  FIELD_GUIDANCE,
  type FieldGuidanceRecord,
} from "@/lib/cbam/field-guidance";
import { deriveMaterialRequirements } from "@/lib/cbam/validation/material-input-registry";
import { createFourDossierCase } from "../fixtures/four-dossiers";

const REQUIRED_KEYS: (keyof FieldGuidanceRecord)[] = [
  "fieldPath",
  "label",
  "required",
  "whyRequired",
  "expectedFormat",
  "acceptedEvidenceTypes",
  "preferredIssuerCategories",
  "example",
  "responsibleParty",
  "relatedStep",
  "legalBasis",
  "blockingLevel",
  "periodGuidance",
  "gapImpact",
];

const SPECIAL_PATHS = [
  "importerIdentity.eoriNumber",
  "goods.*.cnCode",
  "goods.*.productionVolume",
  "gridEmissionFactor",
  "reportingPeriod.year",
  "installation.systemBoundaries",
  "exporterIdentity.address",
  "precursors.*.name",
  "precursors.*.quantity",
  "precursors.*.directEmissions",
  "precursors.*.indirectEmissions",
];

describe("field guidance registry", () => {
  it("records complete guidance for every material field", () => {
    expect(FIELD_GUIDANCE.length).toBeGreaterThan(20);
    for (const record of FIELD_GUIDANCE) {
      for (const key of REQUIRED_KEYS) {
        const value = record[key];
        if (Array.isArray(value)) {
          expect(value.length).toBeGreaterThan(0);
        } else if (typeof value === "string") {
          expect(value.trim().length).toBeGreaterThan(0);
        } else if (key === "required") {
          expect(typeof value).toBe("boolean");
        } else if (key === "relatedStep") {
          expect(Number(value)).toBeGreaterThanOrEqual(1);
          expect(Number(value)).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it("covers the mandatory special guidance fields", () => {
    for (const path of SPECIAL_PATHS) {
      const record = getFieldGuidance(path);
      expect(record, `missing guidance for ${path}`).toBeDefined();
    }
  });

  it("covers every material-requirement input path with a guidance record (SSOT)", () => {
    // The material-input registry is the source of truth for what the wizard
    // and the evidence-sufficiency engine demand. Every one of those paths must
    // resolve to a guidance record, otherwise the wizard would show empty
    // accepted-evidence hints and generic messages for required fields.
    for (const key of ["STEEL_IN", "CEMENT_EG", "ALU_CN", "FERTILISER_TR"] as const) {
      const caseData = createFourDossierCase(key);
      const requirements = deriveMaterialRequirements(caseData);
      for (const requirement of requirements) {
        const resolved = getFieldGuidanceForPath(requirement.inputPath);
        expect(
          resolved,
          `${key}: no guidance record for material requirement ${requirement.requirementId} (${requirement.inputPath})`
        ).toBeDefined();
        // Guidance records for requirement paths must carry the evidence
        // acceptance data the link options expose.
        expect(resolved!.acceptedEvidenceTypes.length, `${requirement.inputPath} empty acceptedEvidenceTypes`).toBeGreaterThan(0);
        expect(resolved!.preferredIssuerCategories.length, `${requirement.inputPath} empty preferredIssuerCategories`).toBeGreaterThan(0);
      }
    }
  });

  it("provides specific precursor guidance that instance paths resolve", () => {
    const name = getFieldGuidanceForPath("precursors.0.name");
    expect(name).toBeDefined();
    expect(name!.fieldPath).toBe("precursors.*.name");
    expect(name!.acceptedEvidenceTypes.length).toBeGreaterThan(0);
    const quantity = getFieldGuidanceForPath("precursors.0.quantity");
    expect(quantity).toBeDefined();
    expect(quantity!.acceptedEvidenceTypes.join(" ")).toMatch(/BILL_OF_MATERIALS|MASS_BALANCE|RECONCILIATION/i);
  });

  it("provides operator-address guidance", () => {
    const address = getFieldGuidance("exporterIdentity.address");
    expect(address).toBeDefined();
    expect(address!.acceptedEvidenceTypes).toContain("COMMERCIAL_REGISTRY_EXTRACT");
    expect(address!.blockingLevel).toBe("REQUIRED");
    expect(address!.whyRequired.length).toBeGreaterThan(0);
  });

  it("guides EORI to customs-authority documents", () => {
    const eori = getFieldGuidance("importerIdentity.eoriNumber");
    expect(eori).toBeDefined();
    expect(eori!.acceptedEvidenceTypes).toContain("EORI_REGISTRATION_RECORD");
    expect(eori!.expectedFormat).toMatch(/prefix/i);
    expect(eori!.whyRequired).toMatch(/EORI|declarant/i);
    expect(eori!.preferredIssuerCategories.length).toBeGreaterThan(0);
    expect(eori!.blockingLevel).toBe("MATERIAL_REQUIRED");
    expect(eori!.gapImpact.length).toBeGreaterThan(0);
    expect(eori!.periodGuidance.length).toBeGreaterThan(0);
  });

  it("guides CN codes to customs declarations and BTI", () => {
    const cn = getFieldGuidance("goods.*.cnCode");
    expect(cn).toBeDefined();
    const types = cn!.acceptedEvidenceTypes.join(" ");
    expect(types).toMatch(/CUSTOMS_DECLARATION|BINDING_TARIFF_INFORMATION|CLASSIFICATION/i);
    expect(cn!.example.length).toBeGreaterThan(0);
    expect(cn!.legalBasis.length).toBeGreaterThan(0);
  });

  it("guides production volume to reconciled ledgers", () => {
    const volume = getFieldGuidance("goods.*.productionVolume");
    expect(volume).toBeDefined();
    const types = volume!.acceptedEvidenceTypes.join(" ");
    expect(types).toMatch(/LEDGER|ERP|MASS_BALANCE|RECONCILIATION/i);
    expect(volume!.expectedFormat).toMatch(/t|kg|tonnes|mass/i);
  });

  it("guides grid emission factor to official publications", () => {
    const grid = getFieldGuidance("gridEmissionFactor");
    expect(grid).toBeDefined();
    const types = grid!.acceptedEvidenceTypes.join(" ");
    expect(types).toMatch(/GRID_OPERATOR|COMPETENT_AUTHORITY|SUPPLIER_SPECIFIC/i);
    expect(grid!.expectedFormat).toMatch(/MWh/i);
  });

  it("guides the reporting period to signed closure records", () => {
    const period = getFieldGuidance("reportingPeriod.year");
    expect(period).toBeDefined();
    const types = period!.acceptedEvidenceTypes.join(" ");
    expect(types).toMatch(/CLOSURE|PERIOD|LEDGER/i);
  });

  it("guides system boundaries to monitoring-plan documents", () => {
    const boundaries = getFieldGuidance("installation.systemBoundaries");
    expect(boundaries).toBeDefined();
    const types = boundaries!.acceptedEvidenceTypes.join(" ");
    expect(types).toMatch(/MONITORING_PLAN|PERMIT|PROCESS_MAP|BOUNDARY/i);
    expect(boundaries!.gapImpact.length).toBeGreaterThan(0);
  });

  it("resolves instance paths against wildcard guidance", () => {
    const instance = getFieldGuidanceForPath("goods.2.cnCode");
    const wildcard = getFieldGuidance("goods.*.cnCode");
    expect(instance).toBeDefined();
    expect(instance!.fieldPath).toBe("goods.*.cnCode");
    expect(instance!.label).toBe(wildcard!.label);
  });

  it("attaches related step and responsible party to each record", () => {
    for (const record of FIELD_GUIDANCE) {
      expect(record.relatedStep).toBeGreaterThanOrEqual(1);
      expect(["OPERATOR", "EXTERNAL_VERIFIER", "SYSTEM"]).toContain(record.responsibleParty);
    }
  });
});
