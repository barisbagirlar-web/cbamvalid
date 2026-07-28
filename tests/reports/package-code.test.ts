import { describe, expect, it } from "vitest";
import {
  PACKAGE_CODE_PATTERN,
  derivePackageCodeCandidate,
  resolvePackageCode,
} from "../../functions/src/cbam/report/package-code";

describe("package-code", () => {
  it("derives letter+4-digit codes from a digest", () => {
    const digest = "a".repeat(64);
    const code = derivePackageCodeCandidate(digest, 0);
    expect(code).toMatch(PACKAGE_CODE_PATTERN);
    expect(code).toHaveLength(5);
    expect(code[0]).toMatch(/[A-Z]/);
  });

  it("is deterministic for the same digest and attempt", () => {
    const digest = "b".repeat(64);
    expect(derivePackageCodeCandidate(digest, 0)).toBe(derivePackageCodeCandidate(digest, 0));
  });

  it("changes candidates across collision attempts", () => {
    const digest = "c".repeat(64);
    expect(derivePackageCodeCandidate(digest, 0)).not.toBe(derivePackageCodeCandidate(digest, 1));
  });

  it("prefers stored packageCode over derived fallback", () => {
    expect(
      resolvePackageCode({
        packageCode: "Y7654",
        reportId: `report_${"d".repeat(64)}`,
      })
    ).toBe("Y7654");
  });

  it("derives a display code for legacy seals without packageCode", () => {
    const reportId = `report_${"e".repeat(64)}`;
    expect(resolvePackageCode({ reportId })).toMatch(PACKAGE_CODE_PATTERN);
  });
});
