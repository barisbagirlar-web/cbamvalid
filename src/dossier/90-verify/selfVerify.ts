/**
 * Internal pre-seal self-verification suite (90-verify).
 */
import type { DossierModel } from "../00-schema/dossier-model.schema";
import { recomputeGraphHashes } from "../20-kernel/graph";
import { assertSealDossierPreconditions } from "../70-seal/seal-gates";

export interface SelfVerifyResult {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

export function selfVerifyDossierModel(model: DossierModel): SelfVerifyResult {
  const failures: string[] = [];
  try {
    assertSealDossierPreconditions(model);
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
  }

  if (model.dto.originInScope && model.calcGraph.nodes.length > 0) {
    const recomputed = recomputeGraphHashes(model.calcGraph.nodes);
    if (recomputed.rootHash !== model.calcGraph.rootHash) {
      failures.push(`CALC_ROOT_MISMATCH:${model.calcGraph.rootHash}!=${recomputed.rootHash}`);
    }
    if (recomputed.rootHash !== model.dto.calculationRootHash) {
      failures.push(`DTO_ROOT_MISMATCH:${model.dto.calculationRootHash}!=${recomputed.rootHash}`);
    }
  }

  for (const q of model.dto.quantities) {
    if (!model.calcGraph.nodes.some((n) => n.id === q.sourceNodeId)) {
      failures.push(`QUANTITY_ORPHAN_NODE:${q.sourceNodeId}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function assertSelfVerify(model: DossierModel): void {
  const result = selfVerifyDossierModel(model);
  if (!result.ok) {
    throw new Error(`SELF_VERIFY_FAILED:${result.failures.join("|")}`);
  }
}
