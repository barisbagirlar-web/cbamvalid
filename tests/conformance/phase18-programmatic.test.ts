import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { currentFactoryState, evaluateKillSwitch, type Phase18Config } from "../../scripts/seo/programmatic-factory";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as Phase18Config;
const portfolio = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/portfolio_board.json"), "utf8")) as { data:{ decisions:Array<{clusterId:string;decision:string}> } };
const loops = JSON.parse(readFileSync(resolve(process.cwd(), "data/seo/growth_loops.json"), "utf8")) as { data:{ assignments:Array<{clusterId:string;growthLoop:string}> } };

describe("SEO V6 Phase 18 programmatic factory", () => {
  it("keeps publication blocked while no INVEST + programmatic cluster exists", () => {
    const state = currentFactoryState(config, portfolio, loops);
    expect(state.gateIn).toBe("BLOCKED_NO_INVEST_PROGRAMMATIC_CLUSTER");
    expect(state.activeBatches).toEqual([]);
    expect(state.publicationState).toBe("NO_PUBLICATION");
  });

  it("proposes noindex rather than auto-deleting when indexation misses the configured gate", () => {
    const result = evaluateKillSwitch({
      batchAgeDays: config.thresholds.programmaticEvalDays,
      indexedPct: Math.max(0, config.thresholds.programmaticIndexMinPct - 1),
      proposalAgeDays: config.thresholds.decisionEscalationDays + 1,
      decisionRecorded: false,
      config,
    });
    expect(result.status).toBe("PROPOSE_NOINDEX_REQUIRES_A3");
    expect(result.escalation).toBe(true);
  });
});
