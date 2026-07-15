# Requirement Traceability Matrix - CBAM product readiness

This matrix tracks every mandate requirement, its corresponding implementation file, runtime path, verification tests, evidence, and current implementation status.

| Requirement | Implementation File | Runtime Path | Verification Tests | Evidence File | Status |
|---|---|---|---|---|---|
| Phase 1: Sealing Runtime Correctness | `functions/src/cbam/report/seal-service.ts` | `/api/cases/[caseId]/seal` / Callable | `tests/cbam-engine/sealing.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 2: Remove User Verification | `lib/cbam/calculation/calculation-engine.ts` | Server execution only | `tests/cbam-engine/engine.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 3: Tenant-bound Evidence | `functions/src/cbam/storage/evidence-repository.ts` | Firestore/Storage paths | `tests/integration/firestore-validator.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 4: Five-release entitlement | `functions/src/commerce/entitlement-service.ts` | `/api/entitlements` | `tests/commerce/commerce.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 5: Ruleset fail-closed | `lib/cbam/registry/rulesets.ts` | Engine resolution | `tests/cbam-engine/rulesets.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 6: Independent sectors | `lib/cbam/sectors/` | Sector calculators | `tests/cbam-engine/sectors.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 7: Immutable artifact commit | `functions/src/cbam/report/seal-service.ts` | Cloud storage reads/writes | `tests/reports/reports.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 8: Manifest signing | `functions/src/cbam/report/seal-service.ts` | kms service call | `tests/reports/signing.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 9: Complete 27-component ZIP | `functions/src/cbam/report/zip-builder.ts` | Zip dossier bundle | `tests/reports/zip.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 10: Multi-page PDF + XLSX | `lib/cbam/report/pdf-builder.ts` | PDF/Excel builders | `tests/reports/pdf.test.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 11: Verifier Workspace | `app/(workspace)/verifier/page.tsx` | `/verifier` router | `tests/e2e/verifier.spec.ts` | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 12: Behavioral integration tests | `tests/` | Various test paths | Run test command | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 13: Playwright E2E dossier flow | `tests/e2e/cbam-platform-flow.spec.ts` | Playwright test run | E2E execution | `docs/release/FINAL_EVIDENCE.md` | OPEN |
| Phase 14: Security credentials rotation | `scripts/check-paddle-config.ts` | Build/Config audit | Security scan | `docs/release/FINAL_EVIDENCE.md` | OPEN |
