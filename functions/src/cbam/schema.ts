import { z } from "zod";

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

export const cbamFormSchema = z.object({
  declarantEORI: z.string().min(8).max(17),
  installationName: z.string().min(3),
  
  // CN Code (GTIP) Validator
  cnCode: z.string()
    .length(8, "CN Code must be exactly 8 digits")
    .regex(/^\d+$/, "CN Code must contain only digits")
    .refine((code) => {
      const chapter = code.substring(0, 2);
      return VALID_CBAM_CHAPTERS.includes(chapter);
    }, {
      message: "ERROR: The entered CN Code is not within the scope of CBAM regulation."
    }),

  productionVolume: z.number().positive(),
  electricityConsumed: z.number().min(0),
  directEmissions: z.number().min(0),
  gridEmissionFactor: z.number().min(0, "Factor cannot be negative."),
  
  isCustomGridFactor: z.boolean(),
  customGridFactor: z.number().min(0).optional(),
  
  isComplexGood: z.boolean(),
  precursorDirectEmissions: z.number().min(0).optional(),
  precursorIndirectEmissions: z.number().min(0).optional(),
  
  liabilityAccepted: z.literal(true, {
    message: "You must accept legal liability to proceed."
  })
}).superRefine((data, ctx) => {
  if (data.isCustomGridFactor && (data.customGridFactor === undefined || isNaN(data.customGridFactor))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Custom grid emission factor value is required.", path: ["customGridFactor"] });
  }
  if (data.isComplexGood && (data.precursorDirectEmissions === undefined && data.precursorIndirectEmissions === undefined)) {
     ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Precursor emissions details are required for complex goods.", path: ["precursorDirectEmissions"] });
  }
});

export type CBAMFormData = z.infer<typeof cbamFormSchema>;
