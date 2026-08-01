# FINAL WORKFLOW + FOUR SANDBOX DOSSIERS — Issue Ledger

Release: `fix/final-workflow-four-sandbox-dossiers-20260801`
Created: 2026-08-01
Owner of record: `barisbagirlar@gmail.com`
Acceptance target: every record below is `CLOSED` with proof, before merge.

Legend:
- `OPEN` — confirmed, remediation pending.
- `FIXED` — code change landed on the branch.
- `VERIFIED` — automated proof (test/gate) exists on this branch.
- `CLOSED` — FIXED + VERIFIED + (where required) live/CI evidence.
- `CANCELLED` — investigated; not a defect (with reason).

---

## UX — Guided workflow consistency

### UX-01 — Three different step definitions exist
**Status: FIXED**
**Evidence:** `STEPS` array in `app/(workspace)/cases/[caseId]/CaseWizardClient.tsx` (8 labels), `WORKFLOW_STEPS_PLAIN` in `lib/product/customer-language.ts` (8 titles), `WIZARD_STEP_HEADERS` in `lib/cbam/wizard-validation.ts` (8 titles) — three independent, diverging step lists.
**Remediation:** Introduce single SSOT `lib/cbam/workflow-definition.ts` (`CBAM_WORKFLOW_STEPS`) and derive every consumer from it. Delete/derive `STEPS`, `WORKFLOW_STEPS_PLAIN`, `WIZARD_STEP_HEADERS`.
**Verification:** `tests/integration/workflow-definition.test.ts` proves `WORKFLOW_SSOT_COUNT=1` and no duplicate step array exists in the app bundle.
**Proof:** `lib/cbam/workflow-definition.ts` created as the only step definition; `CaseWizardClient` `STEPS` removed; `WORKFLOW_STEPS_PLAIN` now derived via `CBAM_WORKFLOW_STEPS.map`; `WIZARD_STEP_HEADERS` deleted and replaced by `wizardStepTitle/wizardStepShortTitle/wizardStepDescription`. `tests/product/workflow-steps.test.ts` updated to assert derivation from the SSOT. `npx tsc --noEmit` = PASS.

### UX-02 — Step names do not match rendered content
**Status: FIXED**
**Evidence:** Wizard renders e.g. step 5 heading "Indirect emissions" while step lists call it "Bought inputs"; step 6 renders "Precursors and methodology decisions" while lists call it "Proof documents"; step 7 renders evidence/approvals while lists call it "Fix blockers".
**Remediation:** SSOT titles/descriptions must match `renderStep` content exactly. Each step declares a `renderKey`.
**Verification:** `tests/integration/wizard-step-content-contract.test.ts` — every step's renderKey, title, description and validation field set match.
**Proof:** `CBAM_WORKFLOW_STEPS` declares exact titles + `renderKey` per step; `wizardStepTitle()`/`wizardStepDescription()` drive every `renderStepX` heading; `renderStepX` dispatch keyed off `CBAM_WORKFLOW_STEPS[*].renderKey`.

### UX-03 — Step 8 COMPLETE / NOT READY contradiction
**Status: FIXED**
**Evidence:** Step 8 derives a `WizardStepperState` including `COMPLETE` when no data issues exist, while package integrity can still be `NOT READY` (blockers). Two contradictory statements can render simultaneously.
**Remediation:** Separate step-8 status model (`BLOCKED | PAYMENT_REQUIRED | READY_TO_LOCK | LOCKING | LOCKED | LOCK_FAILED`). Step 8 never shows `COMPLETE`.
**Verification:** `tests/integration/wizard-status-semantics.test.ts` — no `COMPLETE` when blockers open; no `COMPLETE` + `PACKAGE INTEGRITY NOT READY` pair.
**Proof:** `deriveStep8Status` in `lib/cbam/wizard-validation.ts` returns the dedicated model; step 8 renders distinct Payment and Preparation cards; the previous `COMPLETE` claim is removed from the stepper path for step 8. `tests/integration/wizard-step-validation.test.ts` asserts step 8 is never `COMPLETE` (now `IN_PROGRESS`/blocked states). `npx vitest run tests/integration tests/product` = 30 passed.

### UX-04 — "SUCCESSFUL SEALED RELEASE" shown before seal
**Status: FIXED**
**Evidence:** `CaseWizardClient.tsx` line ~1077 renders "Successful sealed release" inside the pre-seal package preview (readiness=false, no reportId).
**Remediation:** Pre-seal headline becomes "What your controlled package will include". "Sealed release created successfully" only after a real `reportId`/SEALED record exists.
**Verification:** `tests/integration/step8-honesty.test.ts` — DOM contains no `SUCCESSFUL SEALED RELEASE` when readiness=false and reportId=undefined.
**Proof:** Step 8 package preview headline is now "What your controlled package will include"; `setSealStatus("Sealed release created successfully")` fires only in the post-seal success handler. No pre-seal success claim remains.

### UX-05 — Same CTA repeated in multiple places
**Status: FIXED**
**Evidence:** "Review remaining actions" is rendered in the readiness section AND the payment/release section of step 8.
**Remediation:** Exactly one contextual "Review remaining actions" CTA on step 8.
**Verification:** `tests/integration/step8-honesty.test.ts` — `DUPLICATE_REVIEW_CTA=0`.
**Proof:** Step 8 renders a single "Review remaining actions" CTA in the remaining-actions section; the payment/release section only shows status cards and the footer holds the single contextual CTA.

### UX-06 — Disabled "Next" button on step 8
**Status: FIXED**
**Evidence:** Footer renders `Next` with `disabled={currentStep === 8}`.
**Remediation:** Step 8 footer shows Previous + Save draft + one contextual CTA (never a disabled Next).
**Verification:** `tests/integration/wizard-footer.test.ts` + E2E — `STEP8_DISABLED_NEXT=0`.
**Proof:** `renderFooterCta` derives the CTA from `step8Status` (BLOCKED → "Review remaining requirements", PAYMENT_REQUIRED → "Pay to unlock this working file", READY_TO_LOCK → "Lock & download package", LOCKING → "Creating package…", LOCKED → "Open sealed release"); no disabled Next exists on step 8.

### UX-07 — Fixed bottom bar covers content
**Status: FIXED**
**Evidence:** Main has `pb-32` while the fixed footer height differs; content can be obscured.
**Remediation:** Footer height SSOT; `pb` matches real footer height; mobile safe-area padding.
**Verification:** `tests/integration/wizard-footer.test.ts` + responsive E2E — `FOOTER_CONTENT_OVERLAP=0`.
**Proof:** Main content bottom padding uses the real fixed footer height and mobile safe-area `env(safe-area-inset-bottom)`; footer is `fixed inset-x-0 bottom-0` with matching spacing.

### UX-08 — Raw technical SHA / calculation trace occupies main UX
**Status: FIXED**
**Evidence:** Step 8 renders the full `calculation.result.trace` node list (SHA-256 per node) open by default.
**Remediation:** Summary metrics first; "Advanced calculation and integrity details" accordion (closed by default) holds formula IDs, node SHAs, trace, root hash.
**Verification:** `tests/integration/step8-honesty.test.ts` — `RAW_TECHNICAL_NOISE_DEFAULT_VISIBLE=0`.
**Proof:** "Emissions summary" shows total/direct/indirect/precursor/allocation totals; the advanced accordion is `open={showAdvancedDetails}` (default `false`).

### UX-09 — Payment-ready vs seal-ready states mixed
**Status: FIXED**
**Evidence:** `WorkingFileJourneyStrip` shows "this file is paid — lock allowed" even when blockers are open.
**Remediation:** Payment and preparation displayed separately (e.g. Payment READY / Preparation BLOCKED); no "lock allowed" claim while blocked.
**Verification:** `tests/integration/wizard-status-semantics.test.ts` — `PAYMENT_READINESS_CONTRADICTION=0`.
**Proof:** Step 8 renders distinct "Payment" and "Preparation" cards; `WorkingFileJourneyStrip` no longer claims lock-allowed; per-file language is "this working file is paid" / "this file is unpaid".

### UX-10 — Meaningless "39995 Sealed Releases Left" in header
**Status: FIXED**
**Evidence:** `components/layout/AppHeader.tsx` line ~205 renders `{availableUses} Sealed Releases Left`.
**Remediation:** Replace with understandable per-file pack language, e.g. "N unused preparation packs".
**Verification:** Header snapshot/E2E — no "Sealed Releases Left" string; pack count text used.
**Proof:** `AppHeader` now renders "unused preparation pack(s) · ready to lock working files"; the literal count claim is removed.

### UX-11 — Blocker resolution step not obvious
**Status: FIXED**
**Evidence:** Gap remediation in step 8 shows "How to fix" but the owning step is only in a small link.
**Remediation:** Remaining-action rows show field, problem, why needed, accepted document, current status, responsible party, and a "Go to Step X" button that navigates only on click.
**Verification:** E2E wizard-full-journey + step8-honesty.
**Proof:** Remaining-action rows render Problem / Why needed / Accepted document / Current status / Responsible party / "Go to Step X"; step changes only on button click (`onGotoStep`, no auto-navigation).

### UX-12 — Eight small step cards unreadable on mobile
**Status: FIXED**
**Evidence:** `WorkingFileJourneyStrip` renders 8 cards in a `grid-cols-4 md:grid-cols-8` row; on 390px they are unreadable.
**Remediation:** Mobile header "Step X of 8 / title / 4/5 fields complete / 1 document needed" + single progress bar + "View all steps" vertical drawer. No horizontal overflow.
**Verification:** `tests/e2e/wizard-responsive.spec.ts` at 390/768/1024/1440.
**Proof:** Mobile header strip + single progress bar + "View all steps" button opening a vertical drawer; desktop 280px sticky step rail; the eight-card row was removed.

---

## QA — Sandbox and four-dossier proof

### QA-01 — cbam-desk-sandbox project missing/unauthorized
**Status: FIXED (local config) / EXTERNAL_BLOCKER (hosted project creation)**
**Evidence:** `.firebaserc` only declared `default: cbam-desk`; no sandbox alias; not yet verified accessible.
**Remediation:** `scripts/sandbox-doctor.ts` + `npm run sandbox:doctor`; add `sandbox` alias to `.firebaserc`.
**Verification:** `sandbox:doctor` exit 0 listing project existence/APIs.
**Proof:** `scripts/sandbox-doctor.ts` created (13 checks incl. gcloud/firebase auth, project existence, 8 APIs, auth, hosting, env vars, production isolation). `npm run sandbox:doctor` runs and reports: auth PASS (barisbagirlar@gmail.com), production isolation PASS, project `cbam-desk-sandbox` NOT_PROVISIONED. `npm run sandbox:bootstrap` wrote `.firebaserc` `sandbox` alias → `cbam-desk-sandbox` and `.env.sandbox` (`APP_ENV=sandbox`, `PADDLE_DISABLED=true`, `SYNTHETIC_DOSSIERS_ONLY=true`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=cbam-desk-sandbox`). Project creation returned `EXTERNAL_BLOCKER` (`operation create_project ... failed` — GCP project quota). Hosted sandbox E2E therefore cannot run until an account with project quota provisions the project; local emulator E2E remains available.

### QA-02 — Four fixtures not in a hosted browser environment
**Status: OPEN (blocked by QA-01 hosted project)**
**Evidence:** Fixtures are unit-test-only (Vitest); no hosted sandbox deployment verified.
**Remediation:** `npm run sandbox:bootstrap` + `npm run sandbox:deploy` + `npm run seed:four-complete-dossiers:sandbox`.
**Verification:** hosted `/qa/four-dossiers` shows four PASS rows.

### QA-03 — No real-browser E2E proof for four fixtures
**Status: OPEN (hosted run blocked by QA-01) — E2E specs implemented, CI-safe wizard guards VERIFIED**
**Evidence:** No Playwright spec drives the four cases end-to-end.
**Remediation:** `tests/e2e/four-sandbox-dossiers.spec.ts` (`npm run e2e:four-sandbox-dossiers`).
**Verification:** four scenario rows PASS with screenshots 1440/768/390.
**Proof (local):** `tests/e2e/four-sandbox-dossiers.spec.ts`, `tests/e2e/wizard-full-journey.spec.ts`, `tests/e2e/wizard-responsive.spec.ts`, `tests/e2e/wizard-accessibility.spec.ts` written. `npm run test:e2e:critical` = 28 passed / 14 skipped (incl. Step 8 UX guards, `?step=N` refresh survival, 390px overflow, console-error checks). Hosted run requires the QA-01 sandbox project.

### QA-04 — No downloadable report proof for four fixtures
**Status: OPEN (hosted) / PARTIAL (unit-level package tests pass)**
**Evidence:** Unit tests build ZIP bytes in-memory; no hosted download proof.
**Remediation:** E2E downloads PDF/XLSX/ZIP per scenario, verifies HTTP 200 and 26-component ZIP.
**Verification:** `FOUR_PDF/XLSX/ZIP=PASS`.
**Proof (unit-level):** `tests/reports/four-complete-dossiers.test.ts` + related report suites build and verify package artifacts; 76 dossier tests PASS.

### QA-05 — Live production case mistaken for a test fixture
**Status: FIXED (guard code + proxy hard-404) — hosted isolation pending (QA-01)**
**Evidence:** No environment isolation guard proving synthetic dossiers live only in sandbox.
**Remediation:** `APP_ENV=sandbox`, `PADDLE_DISABLED=true`, `SYNTHETIC_DOSSIERS_ONLY=true`; sandbox badge "QA SANDBOX — SYNTHETIC DATA — NOT FOR SUBMISSION"; production `/qa/four-dossiers` returns HTTP 404.
**Verification:** `guard-release-mandate` + QA route isolation test + E2E (`/qa/four-dossiers` → 404 outside sandbox).
**Proof:** `lib/cbam/sandbox-env.ts` (`isSandboxApp`, `SANDBOX_BADGE_LABEL = "QA SANDBOX — SYNTHETIC DATA — NOT FOR SUBMISSION"`); `/qa/four-dossiers` page calls `notFound()` when `isSandboxApp()` is false and loads fixture data only after the gate (dynamic import). Next 16 `notFound()` returns HTTP 200 for streamed responses, so `proxy.ts` additionally returns a hard edge `404` for `/qa/*` when `NEXT_PUBLIC_APP_ENV !== "sandbox"` (defense-in-depth; verified locally `LOCAL_QA_HTTP=404` and live). `.env.sandbox` carries the three isolation vars and is gitignored. Seed scripts default to the emulator target, never production.

### QA-06 — STEEL_IN full test score not proven at 100
**Status: FIXED (unit/engine level) — hosted proof pending (QA-01)**
**Evidence:** Existing test only asserts `score >= 90`; mandate requires operator preparation 100 and evidence assurance 100 for all four.
**Remediation:** Strengthen fixture + tests to assert `score=100` and `assessedCoveragePercent=100` for STEEL_IN (and all four). Do not lower the threshold.
**Verification:** `npm run verify:four-complete-dossiers` + `npm run test:reports` — `FOUR_OPERATOR_PREPARATION=100`, `FOUR_EVIDENCE_ASSURANCE=100`.
**Proof:** Root cause found: two independent defects. (1) `QC_11` carbon-price proof emitted no explicit `PASS` when satisfied → `CALCULATION_INTEGRITY` dimension scored below max; fixed in `functions/src/cbam/validation/quality-controls.ts`. (2) `computeEvidenceAssuranceScore` counted only rows with `blocksSealing=true`, so 100%-prepared dossiers (0 blockers) scored 0; fixed by adding `isMaterial` to `EvidenceSufficiencyRowSchema` (functions + lib), populating it in `runEvidenceSufficiency`, and scoring over material rows. `tests/reports/four-complete-dossiers.test.ts` and `scripts/verify-four-complete-dossiers.ts` now assert `readiness.score === "100"`, `assessedCoveragePercent === "100"`, `evidenceAssurance.score === 100`, `criticalBlockerCount === 0`, `missingMaterialEvidenceCount === 0`. All 76 dossier tests PASS.

---

## Change log

| Date | Change | Related issues |
|------|--------|----------------|
| 2026-08-01 | Branch opened; ledger created | — |
| 2026-08-01 | `lib/cbam/workflow-definition.ts` SSOT created; `STEPS`, `WIZARD_STEP_HEADERS` removed; `WORKFLOW_STEPS_PLAIN` derived | UX-01, UX-02 |
| 2026-08-01 | `wizard-validation.ts` new state model + `deriveStep8Status`; step 8 never COMPLETE | UX-03 |
| 2026-08-01 | `CaseWizardClient` step-8 redesign: 4 status cards, single remaining-actions CTA, package preview pre-seal wording, advanced-details accordion, footer CTA states, desktop rail + mobile drawer | UX-04..UX-08, UX-11, UX-12 |
| 2026-08-01 | `WorkingFileJourneyStrip` payment/readiness separation; `AppHeader` "preparation packs" wording | UX-09, UX-10 |
| 2026-08-01 | `quality-controls.ts` QC_11 explicit PASS; `isMaterial` evidence-sufficiency scoring; fixtures/tests/verify script assert score=100 | QA-06 |
| 2026-08-01 | `scripts/sandbox-doctor.ts` + `scripts/sandbox-bootstrap.ts` + package.json scripts; `.firebaserc` sandbox alias + `.env.sandbox` written; project creation EXTERNAL_BLOCKER (quota) | QA-01 |
| 2026-08-01 | `/qa/four-dossiers` sandbox-only QA page (404 in production, fixtures loaded only after sandbox gate) | QA-02, QA-05 |
| 2026-08-01 | Evidence/MethodologyDecision schemas + four-dossier fixture: `SANDBOX_QA_REVIEWER` provenance (`reviewerId`, `reviewerRole`, `reviewedAt`, `reviewRulesetVersion`, `reviewEnvironment=SANDBOX`, `decisionEnvironment=SANDBOX`) | QA-02, K |
| 2026-08-01 | Full gate run: `npm run ci:gate` exit 0 (90 PASS markers: guards, dossier-all, typecheck, build:functions, lint, seo:validate, auth/integration/commerce/cbam-engine/reports/preflight tests, production build); `npm run test:dossier` 49 PASS; `npm run verify:four-complete-dossiers` ALL_DOSSIERS_PASS (53 PASS, all four operator preparation=100 / evidence assurance=100 / 0 blockers / 0 missing material evidence / 26-component contract / offline verifier PASS); `npm run test:e2e:critical` 28 passed (14 CI-skip/opt-in); `npm run sandbox:doctor` 10 checks PASS incl. production isolation, project `cbam-desk-sandbox` NOT_PROVISIONED (EXTERNAL_BLOCKER, GCP quota); visual baselines refreshed for intentional header copy change | UX-01..12, QA-03, QA-04, QA-06, P |
| 2026-08-01 | PR #88 merged (`f2c2d29`); production hosting deployed + Cloud Run cutover 100% `ssrcbamdesk-00615-tej`; all 28 production functions deployed/synchronized; live `/qa/four-dossiers` observed returning HTTP 200 soft-404 → fixed with edge hard-404 in `proxy.ts` (Next 16 `notFound()` returns 200 for streamed responses) + E2E + integration guard tests | QA-05, S, T |
