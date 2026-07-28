/**
 * READ-ONLY scoreboard renderer inputs from DossierModel scores — no arithmetic.
 */
import type { DossierModelDto } from "../../00-schema/dossier-model.schema";

export interface ScoreboardView {
  readonly operatorReadiness: string;
  readonly verifierReserved: string;
  readonly dossierCompleteness: string;
  readonly status: string;
  readonly formula: string;
  readonly definitions: readonly string[];
}

export function scoreboardFromModel(dto: DossierModelDto): ScoreboardView {
  return {
    operatorReadiness: String(dto.scores.operatorReadiness),
    verifierReserved: `${dto.scores.verifierReservedCount} of ${dto.scores.verifierReservedTotal}`,
    dossierCompleteness: String(dto.scores.dossierCompleteness),
    status: dto.scores.status,
    formula: dto.scores.formula,
    definitions: [
      "OPERATOR READINESS — weighted score over operator-controllable requirements",
      "VERIFIER-RESERVED — items only an accredited verifier can complete",
      "DOSSIER COMPLETENESS — blend of operator + verifier completion; always < 100 pre-audit when verifier items remain",
    ],
  };
}
