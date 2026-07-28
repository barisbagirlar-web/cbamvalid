import { describe, expect, it } from "vitest";
import { assessOrigin } from "../../src/dossier/01-ruleset/origin.rules";
import { nodeId } from "../../src/dossier/00-schema/ids";

describe("WP-03 origin scope — BLOCKER regression", () => {
  it("DE → EU_INTERNAL, generation must be blocked", () => {
    const scope = assessOrigin("DE");
    expect(scope.inScope).toBe(false);
    if (!scope.inScope) expect(scope.code).toBe("EU_INTERNAL");
  });

  it("TR → in scope", () => {
    expect(assessOrigin("TR").inScope).toBe(true);
  });

  it("NO → ANNEX_III_EXCLUDED", () => {
    const scope = assessOrigin("NO");
    expect(scope.inScope).toBe(false);
    if (!scope.inScope) expect(scope.code).toBe("ANNEX_III_EXCLUDED");
  });

  it("CH → ANNEX_III_EXCLUDED", () => {
    const scope = assessOrigin("CH");
    expect(scope.inScope).toBe(false);
    if (!scope.inScope) expect(scope.code).toBe("ANNEX_III_EXCLUDED");
  });

  it("rejects empty / malformed ISO2", () => {
    const scope = assessOrigin("");
    expect(scope.inScope).toBe(false);
    if (!scope.inScope) expect(scope.code).toBe("INVALID_ISO2");
  });
});

describe("WP-04 CalcNodeId constructor", () => {
  it("builds canonical IDs", () => {
    expect(nodeId("DIR", "INSTALLATION")).toBe("CBAM.DIR.INSTALLATION");
    expect(nodeId("GOOD", "1", "SEE_PRICED")).toBe("CBAM.GOOD.1.SEE_PRICED");
  });

  it("throws on undefined / empty segments — never truncates", () => {
    expect(() => nodeId("GOOD", undefined as unknown as string, "EE")).toThrow(/segment empty/);
    expect(() => nodeId("GOOD", "", "EE")).toThrow(/segment empty/);
  });
});
