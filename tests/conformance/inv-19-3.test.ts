import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertDdPackageComplete, REQUIRED_DD_FILES } from "../../scripts/seo/board-report";

describe("INV-19.3 DD package completeness", () => {
  it("rejects a DD package missing any required section", () => {
    const root = mkdtempSync(join(tmpdir(), "cbamvalid-dd-"));
    for (const path of REQUIRED_DD_FILES.slice(0, -1)) {
      const full = join(root, path);
      mkdirSync(full.slice(0, full.lastIndexOf("/")), { recursive: true });
      writeFileSync(full, "fixture");
    }
    expect(() => assertDdPackageComplete(root)).toThrow(/INV-19\.3/);
  });
});
