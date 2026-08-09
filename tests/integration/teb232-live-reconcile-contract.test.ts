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
    const live = read("lib/cbam/qa/reconcile-teb232-live.ts");
    expect(route).toContain("requireFirebaseSession(request)");
    expect(route).toContain("token.email_verified === true");
    expect(route).toContain("reconcileTeb232LiveCases");
    expect(reconciler).toContain("TEB232_RECONCILE_IDENTITY_REFUSED");
    expect(live).toContain("TEB232_RECONCILE_IDENTITY_REFUSED");
    expect(live).toContain("params.authenticatedUid !== TEB232_UID");
    expect(live).toContain("params.authenticatedEmail.trim().toLowerCase() !== TEB232_EMAIL");
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

  it("removes only the observed obsolete legacy case while preserving additional Teb232 drafts", () => {
    const live = read("lib/cbam/qa/reconcile-teb232-live.ts");
    expect(live).toContain(
      "case_3d17c39de6e8780fceb0da2f5459455d06c62399eb91be48d83980c7f90ae9c8"
    );
    expect(live).toContain("discoverUserDraftCaseIds");
    expect(live).toContain("userDraftState");
    expect(live).toContain("legacyState");
    expect(live).toContain("await remove(params.db, userDraftState)");
    expect(live).toContain("await restore(params.db, params.bucket, userDraftState)");
    expect(live).toContain("prepareAllTeb232DraftCasesForSeal");
    expect(live).not.toContain("await restore(params.db, params.bucket, legacyState);\n\n  // User-created test drafts");
  });

  it("accepts the canonical four-case subset and bulk-prepares additional working files", () => {
    const client = read("components/cbam/Teb232CaseReconciler.tsx");
    expect(client).toContain("EXPECTED_CASE_IDS");
    expect(client).toContain("EXPECTED_CANONICAL_CASE_COUNT = 4");
    expect(client).toContain("missingCaseIds");
    expect(client).toContain("visibleTotal=${visible.size}");
    expect(client).not.toContain("cases.length !== EXPECTED_CANONICAL_CASE_COUNT");
    expect(client).not.toContain("visible.size !== EXPECTED_CANONICAL_CASE_COUNT");
    expect(client).toContain("case_d8567b26ef12e5a748fc49c7753cfe53eb54c00a8e92b8d98912b5d25d8ab9c5");
    expect(client).toContain("case_a70c36b5348782cc69c7a2c9863bec28f8bb2ad8ac1bff1c6afe7a62966d4c62");
    expect(client).toContain("case_b71ffdbd980f658cd5a738437c27cce4d82546698df12fc2bf7a0bd31e9c286d");
    expect(client).toContain("case_39474ac5ffe36f8df1853df51b3038085edf457cd0561fa1e501ca8231b8b892");
    expect(client).toContain("hasUserCreatedWorkingFiles");
    expect(client).toContain("bulkPrepareIfNeeded");
    expect(client).toContain("prepareAllDrafts: true");
    expect(client).toContain("validateVisibleCases(visibleCases, EXPECTED_CASE_IDS)");
    expect(client).toContain("server preserves extra drafts during canonical repair");
  });

  it("does not parse a 404 HTML response as JSON", () => {
    const client = read("components/cbam/Teb232CaseReconciler.tsx");
    expect(client).toContain('response.headers.get("content-type")');
    expect(client).toContain('contentType.includes("application/json")');
    expect(client).toContain("TEST_CASE_RECONCILE_HTTP_${response.status}");
    expect(client).toContain("TEST_CASE_RECONCILE_INVALID_JSON_${response.status}");
    expect(client).toContain("await response.text().catch");
  });

  it("keeps canonical reconciliation off new and detail routes and never blocks the workspace", () => {
    const client = read("components/cbam/Teb232CaseReconciler.tsx");
    expect(client).toContain('pathname === "/cases"');
    expect(client).not.toContain('pathname.startsWith("/cases")');
    expect(client).toContain('if (!isTarget || state !== "FAILED") return null');
    expect(client).not.toContain("fixed inset-0");
    expect(client).toContain('href="/cases/new"');
    expect(client).toContain("Existing working files, new working files and case detail pages remain");
  });

  it("still requires the canonical cases and a usable entitlement before readiness", () => {
    const client = read("components/cbam/Teb232CaseReconciler.tsx");
    expect(client).toContain("getCases()");
    expect(client).toContain("getEntitlements()");
    expect(client).toContain("EXPECTED_CANONICAL_CASE_COUNT = 4");
    expect(client).toContain("TEST_CASE_READBACK_MISMATCH");
    expect(client).toContain("TEST_ADMIN_ENTITLEMENT_NOT_READY");
    expect(client).toContain("releasesRemaining > 0");
    expect(client).toContain("cbam_cases_cache_");
  });

  it("validates readiness, evidence object bytes and rollback before success", () => {
    const reconciler = read("lib/cbam/qa/reconcile-teb232.ts");
    const draftPreparer = read("lib/cbam/qa/prepare-teb232-drafts-for-seal.ts");
    expect(reconciler).toContain("readiness.completenessPercentage !== 100");
    expect(reconciler).toContain("readiness.criticalBlockers.length !== 0");
    expect(reconciler).toContain("sha256(bytes) !== record.fileHash");
    expect(reconciler).toContain('String(metadata.contentType || "") !== record.mimeType');
    expect(reconciler).toContain("await restoreState(params.db, params.bucket, cleanupState)");
    expect(reconciler).toContain("TEB232_FINAL_STATE_INVALID");
    expect(draftPreparer).toContain("readiness.allGaps.length !== 0");
    expect(draftPreparer).toContain("await restoreFiles(bucket, prefix, fileBackups)");
    expect(draftPreparer).toContain("await caseRef.set(documentBackup)");
  });
});
