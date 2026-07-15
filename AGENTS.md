<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Global Working Protocol (GLOBAL ÜST SEVİYE ÇALIŞMA PROTOKOLÜ)

This protocol is the default working standard for all software development, web application, SaaS, automation, calculation engine, and technical pro-active tasks.

## 1. Communication and Prompt Discipline
- Prompts and replies must be concise, binding, and token-efficient.
- Do not repeat long prompts for the same topic.
- Avoid analysis loops, redundant option listings, and repeating topics.
- Select the strongest solution; document rejected alternatives in at most one line.
- If the issue is clearly defined, proceed to implementation immediately without unnecessary questions.

## 2. End-to-End Architectural Review
Every repair and implementation must trace the entire interaction chain:
User action → Frontend → Client state → Auth/session → API → Backend/service → Database → Storage → Calculation engine → Webhook/queue → Build → Environment → Deploy → Hosting/runtime → Live user outcome.
If a component changes, verify all callers, dependencies, side effects, shared services, database writes, and auth boundaries.

## 3. Root Cause Approach
- No temporary workarounds or symptoms patching.
- Trace logs, call chains, data flow, state transitions, and dependency graphs.
- Identify the root cause using reverse engineering and cross-questioning.
- Never mark a task complete without explaining why the error occurred, which layers it affected, and why it wasn't caught earlier.

## 4. Permanent Remediation & Regression Safeguards
Every correction must include:
Root cause fix + Dependent layer validation + Regression testing + Failure-path testing + Guard verification + Live deployment validation.
The following are strictly banned:
- Temporary workarounds
- Scanner or compliance guard evasion
- Stub or placeholder data
- Try-catch blocks that swallow production failures
- Client-side security or authorization decisions
- Duplicated business rules across layers
- Hardcoded fake results

## 5. Proactive Risk Mitigation
Before executing, evaluate the following scenarios:
- Breakdown of other functional components.
- Race conditions and duplicate requests.
- Retry / idempotency problems.
- Data loss or mutation.
- Cross-user or cross-tenant exposure.
- Environment mismatches (local vs production).
- Cache and stale-state propagation.
- API contract breakage.
- Mixing of `null`, `zero`, `missing`, and `unknown` states.
- Divergence between test commit SHA and deployed SHA.
- Third-party dependency/service downtime.

## 6. Mathematical and Computational Integrity
Every calculation engine must enforce:
- Unit and dimensional consistency.
- Percentage vs decimal interpretation.
- Strict segregation of `null`, `missing`, and `zero` values (never convert missing/null to zero).
- Division-by-zero prevention.
- Handling of negative and extreme values.
- Reporting period consistency.
- Allocation reconciliation.
- Double-counting prevention.
- Deterministic reproducibility.
- Independent validation fixtures (do not generate expected values using the tested functions).

## 7. Production Readiness Verification
The following status indicators do NOT prove production readiness by themselves:
- TypeScript compilation pass
- Linter clean run
- Unit tests pass
- Build succeeded
- Local E2E tests pass
Production closing requires live verification of:
- Build-time environment validation
- Server/client bundle constraints
- Matching deployment SHA
- Live custom domain endpoint response
- Live E2E user flows
- Server runtime logs
- Cookie authentication checks
- Persistent database updates
- Third-party webhook integrations

## 8. Proof Standards
Do not state `PASS`, `fixed`, `production ready`, `sales ready`, `stable`, or `complete` without absolute evidence. If a behavior is not proven, clearly mark it as:
`NOT_PROVEN`, `NOT_IMPLEMENTED`, `FAIL`, or `EXTERNAL_BLOCKER`.

## 9. Closure Standard
Every final report must contain:
- Root cause identified
- Modified components list
- Permanent solution implemented
- Impacted user/data flows
- Tests executed
- Exit code
- Git commit SHA
- Deployment target/URL
- Live custom domain validation outcome
- Remaining genuine blockers (if any)

## 10. Scope
This protocol applies universally to all current and future projects, including:
- CBAMValid
- SectorCalc
- DrFin
- KobiFinansal
- isplani.com.tr
- BistAlarm


# AGENTS.md — CBAMValid

## 1. Mission

Maintain CBAMValid as a production-grade, evidence-linked, verifier-preparation platform for non-EU producers, exporters, operators, importers, and CBAM reporting teams.

The platform must produce a serious operator-prepared dossier that reduces the work required for independent accredited verification.

Primary priorities, in order:

1. Regulatory and legal claim discipline.
2. Calculation correctness and reproducibility.
3. Evidence integrity and traceability.
4. Fail-closed quality controls.
5. Tenant isolation and security.
6. Immutable release packaging.
7. Professional verifier-facing output.
8. Production reliability.

---

## 2. Canonical Product Definition

Canonical product name:

`CBAMValid Exporter Verification Preparation Pack`

Canonical positioning:

`Prepared for Independent Accredited Verification`

The system may produce:

- An operator/exporter-prepared CBAM emissions dossier.
- Evidence-linked calculations.
- Verification-readiness findings.
- Structured data exports.
- A verifier navigation package.
- Immutable sealed release versions.

The system must never claim to produce:

- An accredited verification opinion.
- Reasonable assurance.
- EU approval.
- Customs approval.
- Registry acceptance.
- An accredited verifier certificate.
- An official Registry XML submission.
- Guaranteed legal acceptance.

Use `O3CI field-mapped structured data export`, not `official Registry XML`.

---

## 3. Commercial Unit and Entitlement Contract

Unless explicitly changed by the owner, the commercial unit is:

```text
1 legal operator/exporter
1 production installation
1 reporting year
defined production processes
linked goods/CN groups
```

Canonical entitlement contract:

```text
100 account credits
→ unlock 1 Exporter Verification Preparation Pack
→ exactly 5 successful sealed release versions
```

Rules:

- One successful seal consumes one release entitlement.
- A blocked or failed seal consumes zero.
- Re-download consumes zero.
- The same idempotency key must never consume twice.
- A correction creates a new release.
- Prior releases remain immutable and traceable.
- Do not change pricing, credits, entitlements, or Paddle behavior unless explicitly instructed.
- Payment work is out of scope unless the task explicitly requests payment or checkout changes.

---

## 4. Language, Brand, and Support Rules

- Website-visible content must use standard English only.
- Do not add mixed-language UI copy.
- Canonical brand is `CBAMValid`.
- Canonical support address is `info@cbamvalid.com`.
- Use exactly one mutually exclusive public, authenticated, or workspace header.
- Do not invent verifier logos, accreditation marks, official seals, approval badges, testimonials, or acceptance claims.

---

## 5. Owner and Authorization Rules

Sole owner / super administrator identity:

`barisbagirlar@gmail.com`

Owner authorization must remain server-side and must verify all applicable immutable conditions:

- Exact UID.
- Exact email.
- Verified email.
- Required role.
- Owner status.

Do not weaken owner checks to claims-only authorization.

For every case, evidence object, report, entitlement, release, and download:

- Verify authenticated server session.
- Verify tenant ownership.
- Verify case ownership.
- Verify object path ownership.
- Verify role permissions.
- Never trust client-provided ownership or role state.

Roles:

- Owner
- Data Preparer
- Internal Reviewer
- Read-Only Verifier
- Super Admin

Read-only verifiers must not be able to alter source data, evidence, findings, methods, calculations, entitlements, or releases.

---

## 6. Firebase Architecture

Production project:

`cbam-desk`

Production architecture:

- Firebase Framework-Aware Hosting.
- Next.js SSR/API through the generated second-generation function `ssrcbamdesk`.
- Cloud Run-backed runtime.
- Separate Firebase Functions where explicitly implemented.

Do not convert the project to Firebase App Hosting or Vercel unless explicitly instructed.

Authentication contract:

```text
Firebase client ID token
→ server createSessionCookie()
→ HttpOnly __session cookie
→ server verifySessionCookie()
```

Rules:

- Never store a raw Firebase ID token directly as `__session`.
- Protected routes must use the verified server session.
- Do not mix Bearer-token and cookie authorization without a documented reason.
- Delete or invalidate legacy bad cookies during migration.
- Firebase Admin must use supported static server-only imports.
- Use ADC or explicitly bound secrets.
- Never expose Admin credentials in client bundles.

Secrets:

- Store production secrets in Secret Manager where supported.
- Bind secrets only to the runtime that needs them.
- Never commit secrets.
- Never place secrets in `NEXT_PUBLIC_*`.
- Never print secrets in logs or CI output.

---

## 7. Case and Scope Model

Every case must have a stable, explicit scope:

- Case ID.
- Owner ID.
- Case version.
- Legal operator/exporter.
- Installation.
- Installation country.
- Reporting year and period.
- Production route.
- System boundary.
- Included and excluded processes.
- Linked goods and CN codes.
- Simple/complex goods classification.
- Precursor scope.
- Direct and indirect emissions basis.
- Allocation method.
- Ruleset version.
- Engine version.
- Release status.

Do not silently widen a case from one installation, year, or process boundary to another.

---

## 8. Evidence Integrity Standard

Every material datum must support evidence lineage where required.

Evidence record minimum fields:

- Evidence ID.
- File name.
- Document type.
- Issuer.
- Issue date.
- Reporting period.
- MIME type.
- File size.
- Storage path.
- SHA-256 hash.
- Upload timestamp.
- Uploader.
- Confidentiality.
- Review status.
- Support status.
- Linked input fields.
- Linked calculations.
- Page, sheet, row, cell, or section reference.
- Reviewer note.

Final sealing standard:

- `reviewStatus` must be `APPROVED`.
- `supportStatus` must be `SUPPORTED`.
- `PARTIALLY_SUPPORTED` is not equivalent to full support.
- Pending, rejected, unsupported, missing, tampered, unlinked, cross-tenant, or physically absent evidence must block sealing.
- The physical file bytes must match the registered SHA-256 and byte size.
- Duplicate files must be detected by hash.
- Evidence paths must remain tenant- and case-bound.
- Do not rely on metadata alone when the file bytes can be verified.

---

## 9. Calculation Engine Standard

All authoritative calculations must run server-side.

Required qualities:

- Deterministic.
- Reproducible.
- Versioned.
- Traceable.
- Unit-safe.
- Fail-closed.
- Independently testable.
- Reconciled at installation and per-good level.

Every calculation change must review:

- Units and dimensions.
- kg/t and kWh/MWh conversion.
- Percent/fraction semantics.
- Null versus zero.
- Negative and non-finite values.
- Zero denominators.
- Reporting-period consistency.
- Precursor inclusion.
- Direct/indirect emissions separation.
- Allocation shares.
- Allocation total equals 1 within documented tolerance.
- Allocated emissions reconcile to installation totals.
- No precursor double counting.
- No direct/indirect double counting.
- Rounding stage and mode.
- Deterministic hash generation.
- Server/client preview parity.

Rules:

- Preserve full precision in intermediate calculations.
- Use explicit final rounding, normally `ROUND_HALF_UP`, only at the defined reporting stage.
- Never generate test expectations from the function under test.
- Golden fixtures must be independently calculated.
- Missing material data must block authoritative results.
- A client preview is advisory and must never become the sealed authoritative result.

---

## 10. Calculation Trace Contract

Every authoritative calculation node must record:

- Calculation ID.
- Formula ID.
- Formula version.
- Regulatory or technical source.
- Source version.
- Effective date.
- Inputs.
- Input units.
- Conversions.
- Intermediate calculations.
- Assumptions.
- Warnings.
- Output value.
- Output unit.
- Rounding policy.
- SHA-256 node hash.

The package must also include:

- Calculation root hash.
- Evidence root hash where implemented.
- Case snapshot hash.
- Manifest hash.
- File hashes.
- Release hash.

Same case snapshot + same ruleset + same engine version must produce the same deterministic result and trace.

---

## 11. Quality-Control and Seal Rules

Final sealing must fail closed.

Block sealing when any material condition exists, including:

- Missing operator or installation identity.
- Invalid reporting period.
- Invalid or unsupported CN code.
- Unsupported sector.
- Missing production quantity.
- Unsupported units.
- Missing direct emissions.
- Missing electricity or factor data where required.
- Incomplete evidence coverage.
- Evidence not internally approved.
- Evidence not fully supported.
- Hash or byte-size mismatch.
- Missing physical evidence file.
- Missing precursor decision or precursor evidence.
- Allocation total not reconciled.
- Missing allocation methodology.
- Missing calculation trace.
- Invalid calculation hash.
- Calculation warning.
- Open material finding.
- Open blocking quality control.
- Missing ruleset or engine version.
- Incomplete package contract.

Allowed internal statuses:

- `DRAFT`
- `INCOMPLETE`
- `REVIEW_REQUIRED`
- `READY_WITH_WARNINGS`
- `READY_FOR_INDEPENDENT_VERIFICATION_PREPARATION`
- `SEALED`
- `SUPERSEDED`
- `REVOKED`

Never assign `VERIFIED` as a system-generated status.

---

## 12. Methodology Governance

Material methodology decisions must be versioned and reviewable.

Minimum decision fields:

- Decision ID.
- Topic.
- Selected method.
- Reason.
- Legal or technical basis.
- Evidence IDs.
- Assumptions.
- Rejected alternative.
- Reason for rejection.
- Responsible person.
- Internal reviewer.
- Review status.
- Ruleset version.
- Timestamp.
- Change history.

Required decision topics include:

- System boundary.
- Production route.
- CN classification.
- Precursor applicability.
- Allocation method.
- Non-associated flows.
- Direct-emission method.
- Electricity-factor method.
- Actual/default value choice.
- Estimate method.
- Carbon-price treatment.
- Materiality treatment.
- Installation-visit preparation.

---

## 13. Findings and Remediation

Every finding must support:

- Finding ID.
- Issue type.
- Requirement.
- Severity.
- Materiality.
- Affected field or result.
- Detected value.
- Corrected or expected value.
- Quantitative impact.
- Root cause.
- Required evidence.
- Corrective action.
- Responsible party.
- Due date.
- Status.
- Recalculation reference.
- Closure note.
- Closure evidence.
- Reviewer.

Open material findings must block sealing.

Do not silently suppress warnings or automatically close findings.

---

## 14. Package Contract

The premium package must preserve the canonical 23 top-level components unless the owner explicitly approves a versioned contract change:

1. Product Scope Assessment
2. CN Code Reasoning
3. Required Data Checklist
4. Installation Monitoring Plan
5. Production Process Map
6. System Boundary Register
7. Source Stream Register
8. Emission Source Register
9. Measurement and Meter Register
10. Activity Data Ledger
11. Evidence Register
12. Field-to-Evidence Matrix
13. Methodology Decision Log
14. Embedded Emissions Calculation Annex
15. Operator Emissions Report
16. Operator Summary Emissions Report
17. Verification Readiness Assessment
18. Misstatement and Non-Conformity Register
19. Corrective Action Log
20. O3CI Field Mapping
21. Calculation Trace JSON
22. Data Integrity Manifest
23. Supporting Evidence Folder

Rules:

- Required files must exist.
- PDF files must open and render.
- Tables must not clip or overflow.
- Every manifest-listed file must exist in the ZIP.
- Every file size and SHA-256 must match.
- The manifest must be independently verifiable from ZIP bytes.
- A package with report-quality status other than PASS must not be generated as a sealed release.
- Evidence bytes must be checked before packaging.
- Re-download must return the identical immutable release.

---

## 15. PDF and Verifier Presentation Standard

Reports must be professional and operationally usable:

- Corporate cover.
- Clear operator-prepared status.
- Verifier-completion boundary.
- Report ID, case ID, release ID, version, date, ruleset, and engine version.
- Page numbers.
- Header/footer.
- Repeated table headings.
- No clipped text.
- No table overflow.
- No orphan headings.
- Selectable text.
- Clear units.
- Evidence references.
- Method references.
- Findings and remediation references.
- Integrity hashes.
- Confidentiality markings.
- Black-and-white print usability.

Presentation quality never substitutes for calculation or evidence quality.

---

## 16. Regulatory Content Rules

- Regulatory rules must be versioned.
- Do not hardcode an unverified legal claim as timeless truth.
- Preserve the exact regulation, implementing-rule, factor-dataset, ruleset, and effective-date basis used by each sealed release.
- Historical sealed releases must not change when rules are updated.
- Deprecated methods must be blocked for new releases when the ruleset marks them invalid.
- Never invent regulation numbers, accreditation requirements, deadlines, factors, or official acceptance claims.
- When the legal basis is uncertain or not freshly verified, mark it `NOT_PROVEN` and do not present it as authoritative.

---

## 17. Security and Tenant Isolation

Minimum controls:

- HttpOnly server session.
- Server-side authentication.
- Object-level authorization.
- Tenant-bound case access.
- Tenant-bound evidence paths.
- Tenant-bound release and report access.
- Signed short-lived private download URLs.
- Input schema validation.
- CSRF protection where applicable.
- Rate limiting.
- File type and size controls.
- Malware scanning where implemented.
- Path traversal protection.
- Replay protection.
- Idempotency.
- Concurrency-safe sealing.
- Immutable report storage.
- Append-only audit events.
- Backup and disaster-recovery planning.
- Data retention and deletion policy.

Never trust client-supplied entitlement, role, owner, price, credit, result, hash, or storage path.

---

## 18. Change Protocol

For every task:

1. Reproduce the issue.
2. Trace the complete call chain and state transitions.
3. Identify the root cause.
4. Apply the smallest permanent fix.
5. Review all callers, importers, server/client boundaries, persistence paths, entitlements, audit events, and error paths.
6. Add focused regression tests.
7. Run targeted tests.
8. Run full release gates after targeted tests pass.
9. Preserve unrelated user changes.
10. Do not deploy, merge, force-push, rewrite history, or run destructive migrations without explicit authorization.

When ambiguity exists, use the least invasive interpretation and record `[ASSUMPTION]`. Ask only when proceeding would create material or irreversible risk.

---

## 19. Required Test Gates

Minimum final gates:

```text
TYPECHECK=PASS
FUNCTIONS_BUILD=PASS
LINT=PASS
AUTH_TESTS=PASS
CBAM_ENGINE_TESTS=PASS
REPORT_TESTS=PASS
VERIFIER_GRADE_GUARD=PASS
SECURITY_GUARDS=PASS
PRODUCTION_BUILD=PASS
```

Calculation-specific gates:

```text
INDEPENDENT_GOLDEN_FIXTURES=PASS
UNIT_DIMENSION_TESTS=PASS
NULL_ZERO_NEGATIVE_EXTREME_TESTS=PASS
PRECURSOR_TESTS=PASS
MULTI_GOOD_ALLOCATION=PASS
ALLOCATION_RECONCILIATION=PASS
DOUBLE_COUNTING_GUARD=PASS
ROUNDING_TESTS=PASS
DETERMINISTIC_REPLAY=PASS
TRACE_HASH_VERIFICATION=PASS
```

Package-specific gates:

```text
23_COMPONENT_CONTRACT=PASS
ZIP_FILE_EXISTENCE=PASS
MANIFEST_HASH_VERIFICATION=PASS
FILE_SIZE_VERIFICATION=PASS
EVIDENCE_BYTE_HASH_VERIFICATION=PASS
PDF_VISUAL_QA=PASS
IMMUTABLE_REDOWNLOAD=PASS
FAILED_SEAL_NO_CONSUME=PASS
IDEMPOTENT_SEAL=PASS
```

Production readiness also requires:

```text
DEPLOYED_SHA=PROVEN
LIVE_SHA=PROVEN
LIVE_ENDPOINT=PASS
REAL_BROWSER_E2E=PASS
RUNTIME_LOGS=REVIEWED
AUTH_PERSISTENCE=PASS
TENANT_ISOLATION=PASS
PRIVATE_DOWNLOAD_AUTHORIZATION=PASS
```

Do not claim production readiness from source code or CI alone.

---

## 20. Evidence and Status Language

Use only:

- `PASS`
- `FAIL`
- `NOT_PROVEN`
- `NOT_IMPLEMENTED`
- `EXTERNAL_BLOCKER`

Never fabricate PASS.

A command is PASS only with actual exit code and relevant output.

A live feature is PASS only when the deployed runtime path is proven.

---

## 21. Final Delivery Format

Every completed task must report:

```text
ROOT_CAUSE=
AFFECTED_CALL_CHAIN=
CHANGED_FILES=
PERMANENT_FIX=
REGRESSION_PROTECTION=
TYPECHECK=
FUNCTIONS_BUILD=
LINT=
AUTH_TESTS=
CBAM_ENGINE_TESTS=
REPORT_TESTS=
SECURITY_GUARDS=
PRODUCTION_BUILD=
COMMIT_SHA=
PR=
DEPLOYED_SHA=
LIVE_SHA=
LIVE_ENDPOINT=
BROWSER_E2E=
RUNTIME_LOGS=
UNRESOLVED_BLOCKERS=
FINAL_ACCEPTANCE=
```

Do not hide skipped tests, incomplete evidence, or external blockers.

---

## 22. Prohibited Actions

Do not:

- Claim accredited verification or guaranteed acceptance.
- Generate fake verifier details, accreditation numbers, assurance statements, or site-visit conclusions.
- Disable quality gates to obtain green CI.
- Weaken evidence requirements.
- Treat `PARTIALLY_SUPPORTED` as fully supported for sealing.
- Convert missing values to zero without an explicit formula rule.
- Put authoritative formulas in client code.
- Trust client-provided credits, ownership, or seal status.
- Modify payment logic unless explicitly requested.
- Deploy to production without explicit authorization.
- Delete immutable releases or audit history.
- Rewrite broad architecture for a narrow bug.
- Use unsafe casts, blanket ignores, error swallowing, or `any` as a permanent fix.
