"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orchestrateCalculation = orchestrateCalculation;
const applicability_engine_1 = require("./applicability-engine");
const actual_value_engine_1 = require("./actual-value-engine");
const default_value_engine_1 = require("./default-value-engine");
const certificate_engine_1 = require("./certificate-engine");
const calculation_engine_1 = require("../calculation/calculation-engine");
function orchestrateCalculation(input) {
    const cnCode = input.cnCode;
    const totalMass = input.productionVolume || 0;
    // 1. Determine Applicability & de minimis thresholds
    const applicability = (0, applicability_engine_1.determineApplicability)({
        cnCode,
        totalMassTonnes: totalMass,
        role: input.role,
    });
    // 2. Determine default emissions availability
    const defaultFactors = (0, default_value_engine_1.getDefaultEmissions)(applicability.sector);
    const hasOfficialDefaults = defaultFactors !== null;
    // 3. Validate emission pathway
    const pathway = (0, actual_value_engine_1.validateEmissionPathway)({
        hasActualData: input.hasActualData,
        isVerified: input.isVerified,
        hasOfficialDefaults,
    });
    // 4. Resolve certificate price
    const pricing = (0, certificate_engine_1.resolveCertificatePrice)({
        importYear: input.importYear,
        importQuarter: input.importQuarter,
    });
    const res = (0, calculation_engine_1.executeDeterministicCalculation)(Object.assign(Object.assign({}, input), { importQuarter: input.importQuarter || 1 }));
    // Re-map internal specific direct/indirect calculations
    let specificDirect = 0;
    let specificIndirect = 0;
    if (totalMass > 0) {
        if (input.hasActualData) {
            const direct = Number(input.directEmissionsInput || 0);
            const indirect = Number(input.electricityConsumedInput || 0) * Number(input.gridEmissionFactorInput || 0.45);
            const precursorDirect = input.isComplexGood ? Number(input.precursorDirectEmissionsInput || 0) : 0;
            const precursorIndirect = input.isComplexGood ? Number(input.precursorIndirectEmissionsInput || 0) : 0;
            specificDirect = Number(((direct + precursorDirect) / totalMass).toFixed(4));
            specificIndirect = Number(((indirect + precursorIndirect) / totalMass).toFixed(4));
        }
        else if (defaultFactors) {
            specificDirect = defaultFactors.directFactor;
            specificIndirect = defaultFactors.indirectFactor;
        }
    }
    const grossCertificates = Math.max(0, res.totalEmbeddedEmissions - res.freeAllocationAdjustment);
    // Formulas registry for verification audit trails
    const formulasUsed = {
        totalDirect: "InstallationDirect + PrecursorDirect",
        totalIndirect: "(ElectricityConsumed * GridFactor) + PrecursorIndirect",
        totalEmbedded: "TotalDirectEmissions + TotalIndirectEmissions",
        freeAllocation: "TotalEmbeddedEmissions * BenchmarkFactor",
        grossCertificates: "max(0, TotalEmbeddedEmissions - FreeAllocationAdjustment)",
        eligibleCertificateReduction: "floor((CarbonPricePaidPerTco2e * EmbeddedEmissions) / CertificatePrice)",
        netCertificates: "max(0, GrossCertificates - EligibleCertificateReduction)",
        cost: "NetCertificatesDue * CertificatePrice",
    };
    return {
        inputs: input,
        applicability,
        pathway,
        pricing,
        specificDirectEmissions: specificDirect,
        specificIndirectEmissions: specificIndirect,
        totalDirectEmissions: Number((specificDirect * totalMass).toFixed(4)),
        totalIndirectEmissions: Number((specificIndirect * totalMass).toFixed(4)),
        totalEmbeddedEmissions: res.totalEmbeddedEmissions,
        freeAllocationAdjustment: res.freeAllocationAdjustment,
        carbonPriceDeduction: res.carbonPriceDeduction,
        grossCertificates,
        // Decoupled fields mapping:
        embeddedEmissionsTco2e: res.embeddedEmissionsTco2e,
        carbonPricePaidCurrency: res.carbonPricePaidCurrency,
        carbonPricePaidPerTco2e: res.carbonPricePaidPerTco2e,
        eligibleCertificateReduction: res.eligibleCertificateReduction,
        certificatesBeforeReduction: res.certificatesBeforeReduction,
        certificatesAfterReduction: res.certificatesAfterReduction,
        netCertificatesDue: res.netCertificatesDue,
        estimatedCertificateCostEur: res.estimatedCertificateCostEur,
        costPerTonneProductEur: totalMass > 0 ? Number((res.estimatedCertificateCostEur / totalMass).toFixed(2)) : 0,
        dataCompletenessScore: res.dataCompletenessScore,
        formulasUsed,
        traces: res.traces,
    };
}
//# sourceMappingURL=calculation-orchestrator.js.map