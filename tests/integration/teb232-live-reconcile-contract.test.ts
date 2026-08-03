import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Teb232 live reconciliation and translation-safety contract", () => {
  it("blocks browser translation from mutating the React workspace DOM", () => {
    const layout = read("app/(workspace)/layout.tsx");
    expect(layout).toContain('google: "notranslate"');
    expect(layout).toContain('className="notranslate');
    expect(layout).toContain('translate="no"');
    expect(layout).toContain("Teb232CaseReconciler");
  });

  it("requires the exact authenticated verified Teb232 identity", () => {
    const route = read("app/api/qa/reconcile-teb232/route.ts");
    const reconciler = read("lib/cbam/qa/reconcile-teb232.ts");
    expect(route).toContain("requireFirebaseSession(request)");
    expect(route).toContain("token.email_verified === true");
    expect(route).toContain("reconcileTeb232LiveCases");
    expect(reconciler).toContain("TEB232_RECONCILE_IDENTITY_REFUSED");
    expect(reconciler).toContain("params.authenticatedUid !== TEB232_UID");
    expect(reconciler).toContain("params.authenticatedEmail.trim().toLowerCase() !== TEB232_EMAIL");
  });

  it("routes the controlled account away from tenant-wide admin cases", () => {
    const listPage = read("app/(workspace)/admin/cases/page.tsx");
    const detailPage = read("app/(workspace)/admin/cases/[caseId]/page.tsx");
    for (const source of [listPage, detailPage]) {
      expect(source).toContain('const TEB232_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652"');
      expect(source).toContain('const TEB232_EMAIL = "teb232@gmail.com"');
      expect(source).toContain("admin.uid === TEB232_UID");
      expect(source).toContain('redirect("/cases")');
    }
  });

  it("removes the fifth observed legacy case through an exact allowlist path", () => {
    const live = read("lib/cbam/qa/reconcile-teb232-live.ts");
    expect(live).toContain(
      "case_3d17c39de6e8780fceb0da2f5459455d06c62399eb91be48d83980c7f90ae9c8"
    );
    expect(live).toContain("discoverLegacyExtraState");
    expect(live).toContain("restore(params.db, params.bucket, state)");
  });

  it("keeps the workspace blocked until four cases and a usable entitlement read back", () => {
    const client = read("components/cbam/Teb232CaseReconciler.tsx");
    expect(client).toContain("getCases()");
    expect(client).toContain("getEntitlements()");
    expect(client).toContain("EXPECTED_CASE_COUNT = 4");
    expect(client).toContain("TEST_CASE_READBACK_MISMATCH");
    expect(client).toContain("TEST_ADMIN_ENTITLEMENT_NOT_READY");
    expect(client).toContain("releasesRemaining > 0");
    expect(client).toContain("cbam_cases_cache_");
  });

  it("validates readiness, evidence object bytes and rollback before success", () => {
    const reconciler = read("lib/cbam/qa/reconcile-teb232.ts");
    expect(reconciler).toContain("readiness.completenessPercentage !== 100");
    expect(reconciler).toContain("readiness.criticalBlockers.length !== 0");
    expect(reconciler).toContain("sha256(bytes) !== record.fileHash");
    expect(reconciler).toContain('String(metadata.contentType || "") !== record.mimeType');
    expect(reconciler).toContain("await restoreState(params.db, params.bucket, cleanupState)");
    expect(reconciler).toContain("TEB232_FINAL_STATE_INVALID");
  });
});
