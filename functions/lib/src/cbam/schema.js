"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cbamFormSchema = void 0;
const zod_1 = require("zod");
// List of valid CBAM chapters (first 2 digits of CN Code)
const VALID_CBAM_CHAPTERS = [
    "72", // Iron and Steel
    "73", // Articles of Iron and Steel
    "76", // Aluminium and articles thereof
    "25", // Cement
    "27", // Electricity
    "28", // Hydrogen (Inorganic chemicals)
    "31", // Fertilizers
];
exports.cbamFormSchema = zod_1.z.object({
    declarantEORI: zod_1.z.string().min(8).max(17),
    installationName: zod_1.z.string().min(3),
    // CN Code (GTIP) Validator
    cnCode: zod_1.z.string()
        .length(8, "CN Code must be exactly 8 digits")
        .regex(/^\d+$/, "CN Code must contain only digits")
        .refine((code) => {
        const chapter = code.substring(0, 2);
        return VALID_CBAM_CHAPTERS.includes(chapter);
    }, {
        message: "ERROR: The entered CN Code is not within the scope of CBAM regulation."
    }),
    productionVolume: zod_1.z.number().positive(),
    electricityConsumed: zod_1.z.number().min(0),
    directEmissions: zod_1.z.number().min(0),
    gridEmissionFactor: zod_1.z.number().min(0, "Factor cannot be negative."),
    isCustomGridFactor: zod_1.z.boolean(),
    customGridFactor: zod_1.z.number().min(0).optional(),
    isComplexGood: zod_1.z.boolean(),
    precursorDirectEmissions: zod_1.z.number().min(0).optional(),
    precursorIndirectEmissions: zod_1.z.number().min(0).optional(),
    liabilityAccepted: zod_1.z.literal(true, {
        message: "You must accept legal liability to proceed."
    })
}).superRefine((data, ctx) => {
    if (data.isCustomGridFactor && (data.customGridFactor === undefined || isNaN(data.customGridFactor))) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Custom grid emission factor value is required.", path: ["customGridFactor"] });
    }
    if (data.isComplexGood && (data.precursorDirectEmissions === undefined && data.precursorIndirectEmissions === undefined)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: "Precursor emissions details are required for complex goods.", path: ["precursorDirectEmissions"] });
    }
});
//# sourceMappingURL=schema.js.map