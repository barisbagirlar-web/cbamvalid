# Release Issue Ledger — 2026-07-29

Scope commit at inventory: `2657c65e8787261f305258c7bd170c5874eebef9`

This ledger is append-only for the current release closure. A record may move to
`CLOSED` only with root-cause fix, executed tests, regression check, and concrete
runtime or command evidence.

## SEC-001 — Evidence malware scanning is not operational

- File/route: `lib/cbam/evidence-upload.ts`, `functions/src/cbam/storage/case-repository.ts`, evidence storage trigger
- Problem: Uploaded evidence remains `PENDING`; no trusted scanner produces a server-authoritative `CLEAN` or `INFECTED` result.
- Root cause: The prior hardening implemented fail-closed state and seal guards but did not provision an actual scanner runtime.
- Severity: CRITICAL
- Affected user: Case preparer attempting final seal
- Affected rule: Evidence must be malware-scanned and `CLEAN` before approval/sealing.
- Fix method: Event-driven private scanner, immutable object-generation binding, server-only result transition, audit event, retry/failure state, and deployment configuration.
- Test method: Clean fixture, EICAR fixture, spoofed result rejection, wrong object generation/hash rejection, timeout/failure remains fail-closed, live upload-to-result smoke.
- Regression risk: Scanner outage can block all final seals; false CLEAN would compromise evidence integrity.
- Status: IN PROGRESS
- Closure evidence: Event/generation/hash/metadata-bound scanner, EICAR quarantine, duplicate-event idempotency, stale-definition rejection, private Eventarc invocation, least-privilege service identities and scheduled private CVD mirror are implemented. Owner-callable CLEAN path removed. `npm --prefix services/evidence-malware-scanner test`: 9/9 PASS; production dependency audit: 0 vulnerabilities; Functions build, typecheck and lint: PASS, exit 0. Shell syntax and pinned official upstream commit `4e51c17b1db6adef5daaaf7caeff6cfe546f21bf` verified. Local container build is `NOT_PROVEN` because Docker is not installed (`exit 127`); Cloud Build and live clean/EICAR upload proof remain required.

## REL-001 — Security commit is not the proven production revision

- File/route: Firebase Framework-Aware Hosting / `ssrcbamdesk`
- Problem: Production was last proven on an earlier revision; commit `2657c65` has no deployed/live SHA proof.
- Root cause: Deployment was deliberately deferred because the prior request did not authorize production mutation.
- Severity: CRITICAL
- Affected user: All production users
- Affected rule: Deployed SHA and tested SHA must match.
- Fix method: Complete release gates, commit/push closure changes, deploy through the repository cutover script, verify Cloud Run revision and custom-domain SHA/behavior, retain rollback revision.
- Test method: Full CI gate, deploy output, Cloud Run revision inspection, custom-domain smoke, runtime logs.
- Regression risk: Framework deployment can alter SSR function revision or environment bindings.
- Status: IN PROGRESS
- Closure evidence: Pending.

## SEC-002 — Live tenant-isolation negative paths are not proven

- File/route: Case, evidence, report, seal, and private-download handlers
- Problem: Local authorization tests pass, but live user-A to user-B denial has not been re-proven for this release.
- Root cause: The security changes were not deployed, so production-like negative tests could not validate the changed runtime.
- Severity: CRITICAL
- Affected user: Every tenant
- Affected rule: Object ownership and tenant isolation must be enforced server-side.
- Fix method: Verify all affected handlers, add missing negative tests, deploy, then execute two-identity denial tests for case/evidence/report/download.
- Test method: Unit/integration authorization suite plus authenticated live negative E2E; confirm no data mutation.
- Regression risk: Cross-tenant disclosure or mutation.
- Status: IN PROGRESS
- Closure evidence: Live smoke harness prepared in `scripts/live-tenant-isolation-smoke.ts` covering case/evidence/report/download denial plus clean/EICAR malware waits. Execution remains blocked until REL-001 and SEC-001 live cutover. Related mapping: [Map tenant seal live tests](eeade428-c83f-450f-8e5a-88749e2e2348).

## INT-001 — Live sealed-package integrity and immutable re-download are not proven

- File/route: Seal service, manifest/signature, ZIP activation, verify API, private download
- Problem: The final 23-component package, byte hashes, signature, activation, and identical re-download have local tests but no live proof for this release.
- Root cause: The hardened seal pipeline has not been deployed and exercised end-to-end.
- Severity: HIGH
- Affected user: Paying exporter and independent verifier
- Affected rule: A sealed release must be complete, cryptographically verifiable, immutable, and byte-identical on re-download.
- Fix method: Close any local pipeline gaps, deploy, create a qualified test release, verify ZIP/manifest/signature/hash/size and compare two download digests.
- Test method: Seal activation tests, 23-component contract test, CLI self-verification, live API verification, repeated-download SHA-256 comparison.
- Regression risk: Corrupt or mutable verifier package.
- Status: IN PROGRESS
- Closure evidence: Local V5 offline signature-path blocker closed (INT-004) and private-download missing-hash gate closed (SEC-005). Authenticated two-user denial harness exists as `scripts/live-tenant-isolation-smoke.ts` but live execution remains blocked until REL-001 deploy and scanner cutover. Related mapping: [Map tenant seal live tests](eeade428-c83f-450f-8e5a-88749e2e2348).

- File/route: `src/dossier/01-ruleset/calculation.rules.ts` and authoritative calculator mirrors
- Problem: Non-zero eligible certificate reduction is blocked because the applicable legal formula, paid-price eligibility, and exchange-rate policy are not encoded as a verified versioned rule.
- Root cause: The previous implementation correctly refused to invent a regulatory formula, but did not complete primary-source verification and implementation.
- Severity: HIGH
- Affected user: Exporter claiming a carbon-price-paid reduction
- Affected rule: No unverified reduction may lower CBAM liability.
- Fix method: Verify current primary EU legal sources and effective dates, encode a versioned policy with explicit units/currency/date semantics, independently recompute fixtures, and retain fail-closed behavior outside proven scope.
- Test method: Primary-source trace, manual independent fixtures, EUR/non-EUR/date/partial-support/zero/negative/extreme tests, browser/server/report parity.
- Regression risk: Incorrect reduction creates financial and regulatory misstatement.
- Status: BLOCKED
- Closure evidence: Independent primary-source review on 2026-07-29 confirmed Regulation (EU) 2023/956 Art. 9 creates the deduction right but Art. 9(5) still delegates the conversion formula, yearly-average FX, evidence and certifier rules to an implementing act. The Commission-services draft Ares(2026)4841230 (13 May 2026) is unadopted and explicitly non-authoritative. No adopted Article 9(5) implementing regulation was listed on EUR-Lex or the Commission CBAM legislation inventory. The versioned code records those sources and continues to reject every non-zero EUR/USD/GBP/TRY deduction. `tests/cbam-engine/calculation-parity.test.ts` and `tests/engine/dimensional-safety.test.ts`: 10/10 PASS, exit 0. Related agent: [Verify carbon price law](0508277a-4c03-4c77-b992-ed00045f5946).

## SEC-003 — Unused API credential is exposed as plaintext SSR environment

- File/route: Production Cloud Run service `ssrcbamdesk`
- Problem: An unused third-party API credential is stored as a plaintext environment value and was disclosed by an environment inspection command.
- Root cause: Legacy runtime configuration survived framework deployments even though the repository has no code reference or dependency for that provider.
- Severity: CRITICAL
- Affected user: Production service and account owner
- Affected rule: Secrets must be least-privilege, Secret Manager-bound, never printed, and rotated after exposure.
- Fix method: Remove the variable from the live service and deployment source, revoke/rotate the exposed provider credential, verify no repository/runtime dependency, and prevent secret-valued environment inspection in release scripts.
- Test method: Repository reference scan, redacted Cloud Run environment-name inspection, custom-domain smoke after removal, provider-side revocation confirmation.
- Regression risk: Removing a genuinely used credential could break runtime behavior; repository scan currently shows no consumer.
- Status: BLOCKED
- Closure evidence: Repository scan found zero `ANTHROPIC_API_KEY` or provider references. Redacted live Cloud Run environment-name inspection on 2026-07-29 confirmed `ANTHROPIC_API_KEY` is absent from serving revision `ssrcbamdesk-00593-tuz` (100% traffic), command exit 0. Provider-side revocation cannot be performed with the exposed standard API credential and remains an external account-owner action; no repository or Google Cloud permission can prove revocation.

## ADMIN-001 — Admin user pagination contract is incomplete

- File/route: `functions/src/handlers/admin.ts` / `listAllUsers`
- Problem: `pageToken` is accepted but ignored, so pages after the first cannot be retrieved and the API contract is misleading.
- Root cause: A production handler retained a mock pagination branch.
- Severity: HIGH
- Affected user: Canonical owner/super administrator
- Affected rule: Production paths must not contain placeholder behavior; administrative listing must be deterministic and complete.
- Fix method: Implement validated cursor pagination with a stable ordering/tie-breaker and return a next-page token, or remove the unsupported parameter and expose an explicit bounded contract.
- Test method: First page, next page, duplicate sort key, malformed/stale token, maximum limit, owner-only authorization.
- Regression risk: Missing users or duplicated rows in administrative review.
- Status: IN PROGRESS
- Closure evidence: Cursor encode/decode and bounded Zod schemas implemented in `functions/src/admin/user-pagination.ts` and applied by `listAllUsers`. `tests/auth/admin-user-pagination.test.ts`: PASS (focused suite included in 27/27 follow-up run), exit 0. Live owner callable pagination proof remains pending until Functions deploy.

## INT-002 — Seal service injects synthetic production instrumentation

- File/route: `functions/src/cbam/report/seal-service.ts`
- Problem: The production seal path constructs fixed fuel/electricity meters, calibration dates, uncertainty values, and source streams under a “test-complete instrumentation” block instead of requiring operator-provided case data.
- Root cause: Test fixture completeness was embedded in the authoritative runtime to satisfy dossier gates.
- Severity: CRITICAL
- Affected user: Exporter and independent verifier relying on a sealed dossier
- Affected rule: No placeholder, mock, synthetic or hardcoded material data may enter an authoritative calculation or sealed package.
- Fix method: Remove all synthetic runtime instrumentation; map only schema-validated operator inputs and evidence. Missing instrumentation must create blockers and prevent sealing. Keep complete values solely in independent test fixtures.
- Test method: Missing meter/calibration data blocks seal; operator-provided values propagate exactly; no fixed test identifiers/dates exist in production bundle; sample fixture still produces a valid package.
- Regression risk: Correct fail-closed behavior will block legacy drafts that never captured required instrumentation.
- Status: IN PROGRESS
- Closure evidence: Production seal path no longer invents meters/streams/sources; operator registers are required and QC_13–QC_16 fail closed. `tests/cbam-engine/monitoring-registers.test.ts` and related focused suite: PASS; typecheck PASS; functions build PASS, exit 0. Live sealed-package proof still depends on REL-001/INT-001. Related agent: [Remove synthetic seal data](407cffee-8a43-4474-a276-d78f1e8a3a6b).

## INT-003 — Authoritative case model omits process and monitoring registers

- File/route: `functions/src/cbam/schema.ts`, `lib/cbam/schema.ts`, case wizard, `functions/src/cbam/report/to-raw-case-input.ts`
- Problem: The persisted working-file schema has no production-process, source-stream, emission-source, or meter register. The seal bridge therefore emits `productionProcesses: []` and cannot truthfully populate required monitoring chapters.
- Root cause: The UI/schema stopped at installation-level emissions totals while the dossier contract requires process- and instrument-level lineage.
- Severity: CRITICAL
- Affected user: Exporter preparing a verifier-facing dossier
- Affected rule: Explicit production processes, emission sources, meters, calibration and uncertainty evidence are required; missing material data must block sealing.
- Fix method: Add validated operator-editable registers, evidence links and date/uncertainty constraints; map them without fallback invention; add fail-closed QC and migration defaults for drafts.
- Test method: Empty registers block; complete independent fixture passes; exact case values appear in package; invalid dates/uncertainty/evidence links fail; browser save/reopen parity.
- Regression risk: Existing drafts become correctly incomplete until users supply monitoring data.
- Status: IN PROGRESS
- Closure evidence: `productionProcesses`, `sourceStreamRegister`, `emissionSourceRegister` and `meterRegister` are in the authoritative schema mirrors, wizard step 3, new-case defaults and verifier-grade fixture. Empty/invalid registers block seal; exact values propagate. Focused monitoring-register tests PASS; typecheck PASS; functions build PASS, exit 0. Related agent: [Remove synthetic seal data](407cffee-8a43-4474-a276-d78f1e8a3a6b).

## ADMIN-002 — Admin numeric inputs accept invalid ranges

- File/route: `functions/src/handlers/admin.ts`
- Problem: User/transaction list limits accepted fractions, zero and negative values; token adjustment accepted negative, fractional or unbounded balances.
- Root cause: Admin callable schemas used only an upper limit or an unconstrained number.
- Severity: HIGH
- Affected user: Canonical owner and affected account holders
- Affected rule: Administrative financial mutations and query bounds require strict server validation.
- Fix method: Require bounded positive integer page sizes, validated Firebase document IDs, and bounded non-negative integer token balances.
- Test method: Boundary values pass; zero/negative/fraction/overflow/malformed ID fail schema validation; owner gate remains required.
- Regression risk: Existing invalid admin requests will be rejected instead of reaching Firestore.
- Status: IN PROGRESS
- Closure evidence: Bounded integer/page-size and token schemas applied; `tests/auth/admin-user-pagination.test.ts` covers boundary and invalid ranges PASS. Live owner callable proof remains pending until Functions deploy.

## CI-001 — Repository lint gate excludes large portions of production source

- File/route: `package.json`, `eslint.config.mjs`, previously unlisted app/context/report/script files
- Problem: The `lint` script enumerates selected paths, allowing 44 real source errors and 13 warnings outside the gate; generated `.firebase` and Functions build output also polluted full lint runs.
- Root cause: Lint coverage was implemented as an allow-list instead of all source with precise generated-output ignores.
- Severity: HIGH
- Affected user: All users through undetected regressions
- Affected rule: Full source lint must pass; generated artifacts should be ignored, not production source.
- Fix method: Ignore only generated/private scratch output, lint the repository source tree, replace unsafe `any` and dead imports, correct hook dependencies, and remove confirmed obsolete scripts.
- Test method: `npx eslint .` and the repository `npm run lint` both exit 0 with no production source omitted.
- Regression risk: Newly covered legacy code can reveal real type or hook defects requiring focused regression tests.
- Status: CLOSED
- Closure evidence: `package.json` lint is `eslint .`. Generated artifacts ignored. `npm run lint` and `npx eslint .` exit 0 on 2026-07-29 after all previously reported 44 errors/13 warnings were resolved. Related agent: [Close full lint defects](63e84e4b-ac95-4212-9340-6aa7d26cf3bc).

## SEC-004 — Production callable App Check is not provisioned or enforced

- File/route: `lib/firebase/client.ts`, `functions/src/wrapper.ts`, Firebase App Check/reCAPTCHA Enterprise configuration
- Problem: The client contains optional App Check initialization, but production has no reCAPTCHA Enterprise provider and Functions explicitly deploy with `CBAM_ENFORCE_APP_CHECK=false`; the public privacy notice nevertheless says App Check/reCAPTCHA is used.
- Root cause: Enforcement was made opt-in to avoid rejecting authenticated traffic before provider provisioning, but provider provisioning and the final enforcement cutover were never completed.
- Severity: HIGH
- Affected user: All users of authenticated callable functions
- Affected rule: Public callable endpoints require abuse/replay protection where applicable, and public disclosures must match runtime behavior.
- Fix method: Provision a domain-restricted score key, bind it to the Firebase web app, make the production client key mandatory, deploy client tokens before enforcement, enable enforcement after token telemetry/smoke proof, retain emulator-only bypass, and make production guards fail closed.
- Test method: Policy unit tests, build-time missing-key failure, valid browser token success, missing/invalid/replayed token denial, authenticated owner/user callable regression, live App Check metrics and smoke.
- Regression risk: Enforcing before the client/provider deployment propagates would block every callable.
- Status: IN PROGRESS
- Closure evidence: `gcloud recaptcha keys list` proved `recaptchaenterprise.googleapis.com` is disabled for project `cbam-desk` (exit 1); source inspection proves initialization is conditional and callable enforcement defaults false.

## UI-001 — Public stylesheet overrides pricing utility layout

- File/route: `/pricing`, `public/assets/css/style.css`, `app/globals.css`
- Problem: The live pricing route returns HTTP 200 but renders with collapsed card padding/margins, cramped typography and a severely compressed mobile layout.
- Root cause: The separately loaded legacy marketing stylesheet applies an unlayered universal `* { margin:0; padding:0 }` reset and unlayered element typography. Unlayered CSS outranks Tailwind's layered utility rules, so pricing utility classes are present in the production CSS but lose the cascade.
- Severity: HIGH
- Affected user: Prospective buyer evaluating price and package scope
- Affected rule: The first useful screen and purchase path must be readable, responsive and visually trustworthy.
- Fix method: Declare an explicit cascade order and place all legacy marketing CSS in a lower-priority `legacy-marketing` layer so component utilities remain authoritative without removing legacy site styling.
- Test method: CSS cascade regression test, production build, local desktop/mobile Playwright screenshots, live screenshots after deployment, CTA/link and responsive checks.
- Regression risk: Cascade changes affect every public marketing route; homepage/header/footer visual regression must be checked.
- Status: IN PROGRESS
- Closure evidence: Live desktop and iPhone 13 screenshots on 2026-07-29 reproduce the defect; response HTTP 200 in 0.287s. Production CSS contains the expected utility selectors, proving missing generation is not the cause. `tests/integration/public-css-cascade.test.ts`: 2/2 PASS; typecheck PASS; production build PASS, exit 0. Local Playwright at 1280px and 390px proves 4 cards, 32px card padding, 2/1-column layouts, zero console errors and no horizontal overflow; homepage visual regression screenshot was also reviewed. Live deployment proof remains pending.

## SEO-001 — Pricing page duplicates the canonical brand in its title

- File/route: `/pricing`, `app/(public)/pricing/page.tsx`, `app/(public)/pricing/layout.tsx`, root metadata template
- Problem: The live document title is `Pricing | CBAMValid | CBAMValid`.
- Root cause: The pricing page exports a brand-suffixed title while the root metadata template appends the same suffix; the route layout already owns canonical generated metadata.
- Severity: MEDIUM
- Affected user: Search users, browser-tab users and crawlers
- Affected rule: Every indexable route must have one clear canonical title generated from the SEO source of truth.
- Fix method: Remove the duplicate page-level metadata and retain the route layout's `generateSeoMetadata("/pricing")`.
- Test method: Metadata ownership regression assertion, production build, local/live browser title check and SEO validation.
- Regression risk: Removing both metadata owners would cause a generic site title; the test requires the canonical route layout owner.
- Status: IN PROGRESS
- Closure evidence: Live and pre-fix local Playwright both returned the duplicated title. Regression assertion 2/2 PASS and production build PASS, exit 0. Rebuilt local Playwright now returns `Pricing | USD 449 Exporter Verification Preparation Pack | CBAMValid` at desktop and mobile with zero console errors. Live deployment proof remains pending.

## INT-004 — V5 offline verifier looks for the signature at the wrong path

- File/route: `src/dossier/90-verify/cli/verify-package.js`, sealed V5 ZIP (`Supporting_Evidence/Manifest Signature.sig`)
- Problem: A valid V5 package stores the detached signature under `Supporting_Evidence/`, but the shipped offline CLI only looked at the package root and failed `--strict` with “Manifest Signature.sig missing.”
- Root cause: V5 packaging moved the signature path while the verifier CLI retained the legacy root-only lookup.
- Severity: CRITICAL
- Affected user: Exporter and independent verifier validating a sealed package offline
- Affected rule: A sealed package must be cryptographically self-verifiable with the shipped CLI.
- Fix method: Resolve signature from `Supporting_Evidence/Manifest Signature.sig` first, then the legacy root path; sync dossier mirrors; add strict CLI regression tests.
- Test method: Strict CLI against V5 nested path, legacy root path, and missing-signature failure.
- Regression risk: Packages with only a root signature must continue to verify.
- Status: CLOSED
- Closure evidence: Source, `lib`, and `functions` mirrors updated via `npm run sync:dossier`. `tests/reports/verify-cli-signature-path.test.ts`: 3/3 PASS; functions build, typecheck and lint PASS, exit 0. Related discovery: [Map tenant seal live tests](eeade428-c83f-450f-8e5a-88749e2e2348).

## SEC-005 — Private download accepted missing object SHA-256 metadata

- File/route: `functions/src/handlers/reports.ts` / `getReportDownloadUrl`
- Problem: Signed download URLs were issued when object metadata lacked `sha256`, as long as byte size matched the sealed index.
- Root cause: The integrity gate treated a missing hash as optional instead of fail-closed.
- Severity: HIGH
- Affected user: Report owner downloading a sealed artifact; integrity assurance for immutable re-download
- Affected rule: Private download must prove indexed path, size and SHA-256 before issuing a signed URL.
- Fix method: Require a 64-character lowercase SHA-256 in object metadata and exact equality with the sealed index hash.
- Test method: Source regression assertion; live/private download smoke after deploy.
- Regression risk: Any legacy sealed object missing hash metadata will correctly fail closed until re-sealed.
- Status: CLOSED
- Closure evidence: Handler now rejects missing/malformed/mismatched hashes. `tests/reports/download-integrity-gate.test.ts`: PASS; functions build, typecheck and lint PASS, exit 0. Related discovery: [Map tenant seal live tests](eeade428-c83f-450f-8e5a-88749e2e2348).

