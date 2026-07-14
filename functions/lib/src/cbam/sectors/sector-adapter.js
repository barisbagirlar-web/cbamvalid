"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECTOR_CONFIGS = void 0;
exports.getSectorConfig = getSectorConfig;
exports.SECTOR_CONFIGS = {
    IRON_AND_STEEL: {
        sector: "IRON_AND_STEEL",
        displayName: "Iron and Steel",
        allowedUnits: ["metric_tonne"],
        requiredPrecursors: ["7201", "7202", "7205"],
        defaultBoundaries: "Coke oven, blast furnace, basic oxygen furnace or electric arc furnace processes.",
        allowedProductionRoutes: [
            "Blast Furnace Route (BF-BOF)",
            "Electric Arc Furnace Route (EAF)",
            "Direct Reduced Iron Route (DRI)",
        ],
        helpText: "Applies to primary iron, steel products, scrap metal inputs, coke and coal consumed during smelting.",
    },
    ALUMINIUM: {
        sector: "ALUMINIUM",
        displayName: "Aluminium",
        allowedUnits: ["metric_tonne"],
        requiredPrecursors: ["2606", "2818", "7601", "7602"],
        defaultBoundaries: "Electrolysis, smelting, anode baking, casting processes.",
        allowedProductionRoutes: [
            "Primary Aluminium Electrolysis",
            "Secondary Aluminium Recycling",
        ],
        helpText: "Covers primary and secondary aluminium, anodes, alumina, and recycling/scrap configurations.",
    },
    CEMENT: {
        sector: "CEMENT",
        displayName: "Cement",
        allowedUnits: ["metric_tonne"],
        requiredPrecursors: ["25231000"], // clinker
        defaultBoundaries: "Raw meal preparation, clinker calcination in kiln, cement grinding.",
        allowedProductionRoutes: [
            "Standard Clinker Kiln Process",
            "Alternative Fuel Kiln Process",
        ],
        helpText: "Includes calcination carbon emissions, clinker ratio adjustments, alternative fuels, and grid power.",
    },
    FERTILISERS: {
        sector: "FERTILISERS",
        displayName: "Fertilisers",
        allowedUnits: ["metric_tonne"],
        requiredPrecursors: ["2814", "2808"], // ammonia, nitric acid
        defaultBoundaries: "Ammonia synthesis, nitric acid oxidation, urea granulation.",
        allowedProductionRoutes: [
            "Steam Methane Reforming Ammonia",
            "Nitric Acid Catalytic Oxidation",
        ],
        helpText: "Tracks N2O process emission factors, hydrogen sources, natural gas feedstock, and chemical complexes.",
    },
    HYDROGEN: {
        sector: "HYDROGEN",
        displayName: "Hydrogen",
        allowedUnits: ["metric_tonne"],
        requiredPrecursors: [],
        defaultBoundaries: "Water electrolysis or steam methane reforming processes.",
        allowedProductionRoutes: [
            "Steam Methane Reforming (SMR)",
            "Water Electrolysis (Chlor-Alkali or PEM)",
        ],
        helpText: "Covers hydrogen generation technologies, natural gas reforming inputs, and carbon capture (CCS/CCU).",
    },
    ELECTRICITY: {
        sector: "ELECTRICITY",
        displayName: "Electricity",
        allowedUnits: ["MWh"],
        requiredPrecursors: [],
        defaultBoundaries: "Power generation plant boundaries, net generation.",
        allowedProductionRoutes: [
            "Fossil Fuel Combustion",
            "Renewable Generation Grid Connection",
        ],
        helpText: "Tracks net power generation, fuel heat values, emission factors, and country grid connection periods.",
    },
    DOWNSTREAM_COMPLEX_GOODS: {
        sector: "DOWNSTREAM_COMPLEX_GOODS",
        displayName: "Downstream Complex Goods",
        allowedUnits: ["metric_tonne"],
        requiredPrecursors: ["72", "73", "76"],
        defaultBoundaries: "Finishing, processing, assembly from covered precursor elements.",
        allowedProductionRoutes: [
            "Mechanical Assembly and Coating",
            "Thermal Processing of Semis",
        ],
        helpText: "Applies to complex goods containing iron, steel, or aluminium parts where own process emissions are combined with supplier precursors.",
    },
};
function getSectorConfig(sector) {
    return exports.SECTOR_CONFIGS[sector];
}
//# sourceMappingURL=sector-adapter.js.map