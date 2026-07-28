/**
 * L6 DossierModel — THE SSOT. Deep-frozen. Self-validated via zod.
 */
import { z } from "zod";
import type { CalcGraph } from "../20-kernel/graph";
import type { ScoreBreakdown } from "../40-readiness/score";
import type { VersionStamp } from "../50-model/version-stamp";
import type { AttributionResult } from "../20-kernel/attribution";
import type { CanonicalCase } from "../10-normalize/normalizeCase";

const QuantitySchema = z.object({
  value: z.string().min(1),
  unit: z.enum(["t", "MWh", "tCO2e", "tCO2e/MWh", "tCO2e/t", "fraction"]),
  precision: z.number().int().min(0).max(28),
  sourceNodeId: z.string().regex(/^CBAM\.[A-Z]+(\.[A-Z0-9_]+)*$/),
});

export const DossierModelSchema = z
  .object({
    schemaVersion: z.literal("CBAMVALID-DOSSIER-5.0"),
    caseId: z.string().min(1),
    originInScope: z.boolean(),
    originBlockCode: z.string().nullable(),
    versions: z.object({
      product: z.string().min(1),
      schema: z.string().min(1),
      ruleset: z.object({
        id: z.string().min(1),
        sha256: z.string().nullable(),
      }),
      releaseIteration: z.number().int().positive(),
    }),
    scores: z.object({
      operatorReadiness: z.number().min(0).max(100),
      verifierReservedCount: z.number().int().min(0),
      verifierReservedTotal: z.number().int().min(0),
      dossierCompleteness: z.number().min(0).max(100),
      status: z.enum([
        "NOT_READY",
        "NOT_APPLICABLE_CBAM",
        "READY_WITH_GAPS",
        "OPERATOR_PREPARATION_COMPLETE",
      ]),
      formula: z.string().min(1),
      findings: z.array(z.string()),
    }),
    calculationRootHash: z.string().regex(/^[a-f0-9]{64}$/),
    quantities: z.array(QuantitySchema),
    annexIiSectorsPresent: z.boolean(),
    legalCitations: z.array(
      z.object({
        key: z.string(),
        short: z.string(),
        role: z.string(),
      })
    ),
    nonAssociatedFlows: z.object({
      wasteGasExported: z.string(),
      heatExported: z.string(),
      electricityExported: z.string(),
      nonCbamGoods: z.string(),
    }),
  })
  .strict();

export type DossierModelDto = z.infer<typeof DossierModelSchema>;

export interface DossierModel {
  readonly dto: DossierModelDto;
  readonly canonical: CanonicalCase;
  readonly calcGraph: CalcGraph;
  readonly scores: ScoreBreakdown;
  readonly attribution: AttributionResult;
  readonly versions: VersionStamp;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

export function assertDossierModel(dto: unknown): DossierModelDto {
  return DossierModelSchema.parse(dto);
}

export function freezeDossierModel(model: DossierModel): DossierModel {
  return deepFreeze(model);
}
