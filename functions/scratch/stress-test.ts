import { performDossierCalculations } from "./src/cbam/calculator";
import { AuditReadyCase } from "./src/cbam/schema";

// Mock case matching AuditReadyCase schema
const mockCase: AuditReadyCase = {
  caseId: "case_test_stress_123",
  uid: "test_uid",
  status: "DRAFT",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  data: {
    exporterName: "Global Steel Exporter Ltd",
    installationName: "Smelting Facility North",
    installationCountry: "TR",
    installation: {
      name: { value: "Smelting Facility North", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
      country: { value: "TR", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
      productionRoute: { value: "BF-BOF route", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
      systemBoundaries: "Coke oven, blast furnace, basic oxygen furnace or electric arc furnace processes.",
      unloCode: { value: "TRIST", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" }
    },
    reportingPeriod: {
      year: { value: "2026", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
      quarter: { value: "1", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" }
    },
    goods: [
      {
        cnCode: { value: "72011011", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
        productionVolume: { value: "15000", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
        sector: "IRON_AND_STEEL",
        isComplexGood: true
      }
    ],
    directEmissions: { value: "27750", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
    electricityConsumed: { value: "12000", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
    gridEmissionFactor: { value: "0.45", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
    precursors: [
      {
        name: { value: "Precursor Material A", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
        quantity: { value: "5000", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
        directEmissions: { value: "1200", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" },
        indirectEmissions: { value: "350", sourceType: "VERIFIED", confidenceStatus: "HIGH_ESTIMATE" }
      }
    ],
    carbonPriceRecords: [
      {
        id: "tax_record_1",
        amountPaid: 75500, // EUR paid
        currency: "EUR",
        legislationReference: "Carbon Tax Act Section 4"
      }
    ],
    gapAssessment: []
  }
};

console.log("=== RUNNING MATHEMATICAL STRESS TEST ===");
try {
  const result = performDossierCalculations(mockCase);
  console.log("Total Embedded Emissions (Total Direct + Total Indirect):", result.totalEmbeddedEmissions);
  console.log("Total Direct Emissions (Facility + Precursor):", result.totalDirectEmissions);
  console.log("Total Indirect Emissions (Electricity + Precursor):", result.totalIndirectEmissions);
  console.log("Specific Direct Emissions (4 decimals):", result.specificDirectEmissions);
  console.log("Specific Indirect Emissions (4 decimals):", result.specificIndirectEmissions);
  console.log("Specific Embedded Emissions (4 decimals):", result.specificEmbeddedEmissions);
  console.log("Gross Certificates (No phase-in / 1:1 mapping):", result.certificatesBeforeReduction);
  console.log("Carbon Price Paid Reduction:", result.eligibleCertificateReduction);
  console.log("Net Certificates Due:", result.netCertificatesDue);
  console.log("Estimated Certificate Cost (EUR):", result.estimatedCertificateCostEur);
  console.log("Is Complex Good:", result.isComplexGood);

  // Assertions for exact correctness
  const totalEmbedded = Number(result.totalEmbeddedEmissions);
  const grossCertificates = Number(result.certificatesBeforeReduction);
  
  console.log("\n--- Verification Assertions ---");
  // 1:1 gross certificates mapping assertion
  if (Math.ceil(totalEmbedded) === grossCertificates) {
    console.log("✓ Assertion Passed: Gross Certificates strictly equals ceil(Total Embedded Emissions) [1:1 mapping]");
  } else {
    console.error("✗ Assertion Failed: Gross Certificates does not match ceil(Total Embedded Emissions)");
  }

  // 4-decimal precision check
  if (result.specificDirectEmissions.split(".")[1]?.length === 4 &&
      result.specificIndirectEmissions.split(".")[1]?.length === 4) {
    console.log("✓ Assertion Passed: Specific emissions format matches exactly 4 decimal places");
  } else {
    console.error("✗ Assertion Failed: Specific emissions precision mismatch");
  }

  // Complex good detection
  if (result.isComplexGood === true) {
    console.log("✓ Assertion Passed: isComplexGood correctly flagged based on precursor emissions existence");
  } else {
    console.error("✗ Assertion Failed: isComplexGood flags incorrectly");
  }

} catch (error) {
  console.error("Stress Test Error:", error);
}
