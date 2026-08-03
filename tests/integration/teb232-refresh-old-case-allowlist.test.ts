import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "scripts/refresh-teb232-four-complete-cases.ts"),
  "utf8"
);

const obsoleteCaseIds = [
  "case_518dbf061368d391bfe1f1b6010c9cab37fe1eb8d7321505f667ab396649e9b0",
  "case_4aa949246b04cd9dc0353b93530a50281fde4491531cc4ac1607cf8a90f6ee37",
  "case_ad8cd2d4c03ce3e4ce5b1f3c5c74902583398dc70260097a35b86685beca21eb",
  "case_73bdb993585bfb8744908fc7bf57fb60ab7a0a81c4116f12bc662a674b03eacd",
  "case_3d17c39de6e8780fceb0da2f5459455d06c62399eb91be48d83980c7f90ae9c8",
];

describe("Teb232 obsolete-case cleanup", () => {
  it("removes every legacy working file before restoring the canonical four", () => {
    for (const caseId of obsoleteCaseIds) expect(source).toContain(caseId);
    expect(source).toContain("Exact five obsolete test working files approved for replacement");
  });
});
