/**
 * Programmatic seal precondition — mirrors CI dossier gates that can run in-process.
 * CI can be bypassed; seal service cannot.
 */
import { applicableActStack } from "../01-ruleset/regulations.registry";
import type { DossierModel } from "../00-schema/dossier-model.schema";

export function assertSealDossierPreconditions(model: DossierModel): void {
  if (!model.dto.originInScope) {
    throw new Error(`SEAL_GATE_ORIGIN:${model.dto.originBlockCode || "OUT_OF_SCOPE"}`);
  }
  for (const q of model.dto.quantities) {
    if (!q.sourceNodeId || !q.unit || q.value === undefined || q.value === null || q.value === "") {
      throw new Error(`SEAL_GATE_MODEL_SCHEMA:quantity_missing_fields:${q.sourceNodeId || "?"}`);
    }
  }
  if (!model.dto.scores.formula) {
    throw new Error("SEAL_GATE_SCORE_FORMULA_MISSING");
  }
  // Legal stack must not be empty when citing complete acts
  const stack = applicableActStack();
  if (stack.length === 0) {
    throw new Error("SEAL_GATE_LEGAL_STACK_EMPTY");
  }
  if (model.calcGraph.nodes.length === 0) {
    throw new Error("SEAL_GATE_EMPTY_CALC_GRAPH");
  }
  for (const n of model.calcGraph.nodes) {
    if (!n.id || String(n.id).includes("undefined") || /CBAM_GOOD_$/.test(String(n.id))) {
      throw new Error(`SEAL_GATE_BAD_NODE_ID:${n.id}`);
    }
  }
}
