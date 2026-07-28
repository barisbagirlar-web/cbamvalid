/**
 * L0 RawCaseInput — zod strict parse + branded-unit entry points.
 * Period is a discriminated union: annual cannot carry quarter (WP-13).
 */
import { z } from "zod";

const Iso2 = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "ISO3166_ALPHA2_REQUIRED");

const NonEmpty = z.string().trim().min(1);

export const ReportingPeriodSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("DEFINITIVE_ANNUAL"),
      year: z.number().int().min(2023).max(2100),
    })
    .strict(),
  z
    .object({
      type: z.literal("QUARTERLY"),
      year: z.number().int().min(2023).max(2100),
      quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    })
    .strict(),
]);

export const RawGoodSchema = z.object({
  cnCode: NonEmpty,
  sector: NonEmpty,
  netMassTonnes: NonEmpty,
  allocationShare: NonEmpty.optional(),
  allocationJustification: z.string().optional(),
  processId: z.string().optional(),
});

export const RawProductionProcessSchema = z.object({
  processId: NonEmpty,
  name: NonEmpty,
  annexIiDefinition: z.string().optional(),
  producedGoodIndexes: z.array(z.number().int().nonnegative()).default([]),
  attributedDirectTco2e: NonEmpty.optional(),
  attributedIndirectTco2e: NonEmpty.optional(),
});

export const RawSignOffSchema = z.object({
  role: z.enum(["OPERATOR_PREPARER", "INTERNAL_REVIEWER", "DATA_OWNER"]),
  name: NonEmpty,
  title: NonEmpty,
  signedAt: NonEmpty,
});

export const RawCaseInputSchema = z
  .object({
    caseId: NonEmpty,
    operatorLegalName: NonEmpty,
    installationName: NonEmpty,
    installationCountry: Iso2,
    reportingPeriod: ReportingPeriodSchema,
    directEmissionsTco2e: NonEmpty,
    electricityMwh: NonEmpty,
    gridFactorTco2ePerMwh: NonEmpty,
    goods: z.array(RawGoodSchema).min(1),
    productionProcesses: z.array(RawProductionProcessSchema).default([]),
    signOffs: z.array(RawSignOffSchema).default([]),
    evidenceIds: z.array(NonEmpty).default([]),
  })
  .strict();

export type RawCaseInput = z.infer<typeof RawCaseInputSchema>;
export type ReportingPeriod = z.infer<typeof ReportingPeriodSchema>;

export function parseRawCaseInput(input: unknown): RawCaseInput {
  return RawCaseInputSchema.parse(input);
}
