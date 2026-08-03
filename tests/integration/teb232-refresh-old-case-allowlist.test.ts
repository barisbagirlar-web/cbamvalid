import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "scripts/cleanup-teb232-obsolete-iskenderun-case.ts"),
  "utf8"
);

describe("Teb232 obsolete Iskenderun cleanup", () => {
  it("targets only the exact leftover case and exact customer identity", () => {
    expect(source).toContain(
      'OBSOLETE_CASE_ID = "case_3d17c39de6e8780fceb0da2f5459455d06c62399eb91be48d83980c7f90ae9c8"'
    );
    expect(source).toContain('EXPECTED_EMAIL = "teb232@gmail.com"');
    expect(source).toContain('EXPECTED_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652"');
    expect(source).toContain('const EXECUTE = process.env.EXECUTE === "1"');
    expect(source).toContain("OWNER_MISMATCH");
    expect(source).toContain("CASE_DELETE_READBACK_FAILED");
  });
});
