# Baseline Audit Log - CBAMValid

## Commit & Deployed Info
- **Starting Commit SHA**: `17fcb2f9deb1244e3eff3db448f5a05ab1ee922e`
- **Deployed SHA**: `a2dbe68b97a4053cf4c7c1a3fca4e6d974bbea0e`
- **Dirty Working-Tree State**: Yes (local edits present in workflows, AGENTS.md, package.json, scripts)

## Current Architecture
- **Framework**: Next.js (Framework-Aware Hosting on Firebase)
- **Functions**: Node.js Firebase functions (europe-west1)
- **Authentication**: Firebase Client SDK + HTTP-only `__Host-cbam_session` Session Cookie verification
- **Database**: Firestore (cbam-desk project)
- **Payments**: Paddle Integration (single-product: CBAM_EXPORTER_FINAL_REPORT)

## Current Test Results
- **Auth Unit Tests**: PASS
- **Integration Tests**: PASS
- **Commerce Tests**: PASS
- **Cbam Engine Tests**: PASS
- **Report Tests**: PASS
- **E2E Playwright Tests**: PASS (for basic auth flow)

## Known Blockers
- Sealing service sends empty `inputData: undefined`
- isVerified present in client forms
- Evidence lifecycle is unlinked to review states
- One-use permanent entitlement consumption
- Silent ruleset resolution fallbacks
- Lack of 6 independent sector modules (using generic calculators)
- Mutable PDF generation on download requests
- KMS signatures mocked
- Missing ZIP 27 components (currently 5 components)
- XLSX workbook format missing (placeholder outputs)
- Verifier workspace not implemented
