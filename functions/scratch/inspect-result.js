const { performDossierCalculations } = require("../lib/cbam/calculator");

const mockCase = {
  caseId: "case_test_stress_123",
  uid: "test_uid",
  status: "DRAFT",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
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
};

console.log("=== INSPECTING RESULT OBJECT ===");
try {
  const result = performDossierCalculations(mockCase);
  console.log(result);
} catch (e) {
  console.error(e);
}
