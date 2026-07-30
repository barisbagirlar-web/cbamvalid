import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  resolve(process.cwd(), "app/api/checkout/cbam/route.ts"),
  "utf8"
);

const repairSource = readFileSync(
  resolve(process.cwd(), "scripts/repair-teb232-alu-v5-readiness.mjs"),
  "utf8"
);

describe("CBAM checkout V5 readiness contract", () => {
  it("runs canonical V5 readiness before creating any order", () => {
    const readinessIndex = routeSource.indexOf("const readiness = assessReadiness");
    const blockIndex = routeSource.indexOf('"CASE_NOT_READY_FOR_PAYMENT"');
    const orderCreationIndex = routeSource.indexOf("const orderRef = adminDb.collection");

    expect(routeSource).toContain('import { assessReadiness } from "@/lib/cbam/validation/readiness-score"');
    expect(readinessIndex).toBeGreaterThan(-1);
    expect(blockIndex).toBeGreaterThan(readinessIndex);
    expect(orderCreationIndex).toBeGreaterThan(blockIndex);
  });

  it("keeps duplicate-payment protection ahead of readiness evaluation", () => {
    const paidIndex = routeSource.indexOf('"CASE_ALREADY_PAID"');
    const readinessIndex = routeSource.indexOf("const readiness = assessReadiness");

    expect(paidIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeGreaterThan(paidIndex);
  });

  it("keeps the repair script exact-case, draft-only and dry-run-first", () => {
    expect(repairSource).toContain('const EMAIL = "teb232@gmail.com"');
    expect(repairSource).toContain('const UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652"');
    expect(repairSource).toContain(
      'const CASE_ID = "case_73bdb993585bfb8744908fc7bf57fb60ab7a0a81c4116f12bc662a674b03eacd"'
    );
    expect(repairSource).toContain('const EXECUTE = process.env.EXECUTE === "1"');
    expect(repairSource).toContain('if (String(caseRecord.status || "") !== "DRAFT")');
    expect(repairSource).toContain('result: "DRY_RUN"');
  });
});
