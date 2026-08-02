import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "scripts/refresh-four-complete-dossiers.ts"),
  "utf8"
);

describe("four-sector sandbox refresh safety", () => {
  it("refuses production and every non-sandbox hosted project", () => {
    expect(source).toContain('const PRODUCTION_PROJECT = "cbam-desk"');
    expect(source).toContain('const SANDBOX_PROJECT = "cbam-desk-sandbox"');
    expect(source).toContain("REFUSED_PRODUCTION_PROJECT");
    expect(source).toContain("REFUSED_NON_SANDBOX_PROJECT");
    expect(source).toContain('configured !== SANDBOX_PROJECT');
  });

  it("is dry-run by default and requires explicit apply", () => {
    expect(source).toContain('process.argv.includes("--apply")');
    expect(source).toContain('FOUR_DOSSIER_REFRESH_MODE=${apply ? "APPLY" : "DRY_RUN"}');
    expect(source).toContain("REFRESH_STATUS=DRY_RUN");
    expect(source.indexOf("if (!apply)")).toBeLessThan(source.indexOf("deleteFiles(cleanup)"));
  });

  it("backs up before deletion and restores after a failed replacement", () => {
    const backupIndex = source.indexOf("backupCleanupState(cleanup, backupRoot)");
    const deleteIndex = source.indexOf("deleteFiles(cleanup)");
    const restoreIndex = source.indexOf("restoreCleanupState(db, bucket, cleanup)");
    expect(backupIndex).toBeGreaterThanOrEqual(0);
    expect(deleteIndex).toBeGreaterThan(backupIndex);
    expect(restoreIndex).toBeGreaterThan(deleteIndex);
    expect(source).toContain("ROLLBACK=RESTORED_PREVIOUS_SYNTHETIC_STATE");
  });

  it("prebuilds every package before touching persisted state", () => {
    const buildIndex = source.indexOf("buildDossierSealedPackage(key)");
    const discoverIndex = source.indexOf("discoverCleanupState(db, bucket, packages)");
    const deleteIndex = source.indexOf("deleteFiles(cleanup)");
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    expect(discoverIndex).toBeGreaterThan(buildIndex);
    expect(deleteIndex).toBeGreaterThan(discoverIndex);
    expect(source).toContain("PREBUILD_COMPONENT_CONTRACT_FAILED");
  });

  it("requires one current report and one seal for each known case", () => {
    expect(source).toContain("REPORT_CARDINALITY_FAILED");
    expect(source).toContain("SEAL_CARDINALITY_FAILED");
    expect(source).toContain("LEGACY_REPORT_STILL_PRESENT");
    expect(source).toContain("FOUR_DOSSIER_REFRESH=PASS");
  });
});
