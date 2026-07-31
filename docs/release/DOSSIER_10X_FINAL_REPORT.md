# feat(dossier): complete 10x verifier-ready release gates

## Summary

Implements the DOSSIER 10/10 RELEASE MANDATE for CBAMValid — the verifier-ready
preparation platform for non-EU producers/exporters. The branch carries the
full phased implementation (FAZ 4–16) on top of the merged PR #79 hotfix, plus
three integrity commits that make the sealed package byte-deterministic.

### Scope covered (FAZ)

- **FAZ 4** — Calculation engine: A–H emission segregation, per-node trace
  (formulaId / inputPaths / evidenceIds / legalBasis / calculationHash),
  Decimal.js precision, exact allocation reconciliation.
- **FAZ 5** — Evidence assurance: A–E quality grades, two-basis support model
  (`SUPPORTED_BY_EVIDENCE` / `SUPPORTED_BY_ACCEPTED_METHODOLOGY_DECISION`),
  fail-closed sealing on D/E material inputs.
- **FAZ 6** — Risk register, per-good materiality workpaper, sampling and
  site-visit readiness modules.
- **FAZ 7** — Honest four-indicator scoreboard (Operator Preparation / Evidence
  Assurance / Package Integrity / External Verifier Completion); single 100/100
  removed; verifier-reserved fields excluded from operator score.
- **FAZ 8–9** — 31-section dynamic dossier PDF with data-driven visuals,
  bookmarks, clickable TOC, page numbers, confidential footers; render-QA gate.
- **FAZ 10** — Two-stage immutable artifact flow: artifacts → manifest → KMS
  signature → ZIP → ZIP reopen re-hash → release receipt → public verification.
  Crypto placeholders (`NOT_AVAILABLE` / `UNAVAILABLE`) banned.
- **FAZ 11** — 27-sheet Verifier Workspace XLSX from the same canonical dataset.
- **FAZ 12** — Registry Verification Template Mapping Dataset (no "Official
  Registry XML" claim).
- **FAZ 13** — Premium chapter contract (E-01..E-16 statuses enforced).
- **FAZ 14** — Golden dossier test matrix: 30 mandated scenarios + per-sector
  golden fixtures (totals, per-good results, readiness, findings, manifest set,
  crosswalk, PDF text, XLSX cells, JSON hashes).
- **FAZ 15** — PDF render QA (blank page / overflow / clipped text / margins /
  font / page numbers) via PNG rendering analysis.
- **FAZ 16** — External professional acceptance prep: 3 reviewer roles × 12
  criteria, fail-closed acceptance state.

### Integrity follow-ups (this branch)

- `fix(report): make V5 package immutable and byte-deterministic` — fixed
  `assessmentTimestamp` threading + JSZip folder-entry date pinning.
- `fix(fixtures): store deterministic test key as DER` — fixed test signer that
  passes the tracked-secret scan.
- `fix(scripts): explicit preflight exit semantics` — release mode exits 1 on
  `NOT_READY`; `EXPECT_BLOCKED=1` diagnostic mode exits 0 only on exact
  seal-blocker-ID match.

## Test plan

Local `npm run ci:gate` passes end-to-end:

```
HOSTING_ARCHITECTURE_GUARD=PASS   AUTH_ARCH=PASS   WORKSPACE_NAV=PASS
CASE_RUNTIME_CONTRACT=PASS        VERIFIER_GRADE=PASS  EXTERNAL_ACCEPTANCE=PASS
GITHUB_ACTIONS=PASS               GATE_DOSSIER_ALL=PASS (9 gates + recompute)
TYPECHECK=PASS                    FUNCTIONS_BUILD=PASS
LINT=PASS                         SEO_GATE total=37 fail=0
AUTH=36  INTEGRATION=35  COMMERCE=20  CBAM_ENGINE=49  REPORTS=102  PREFLIGHT=10
PRODUCTION_BUILD=PASS
```

Live server-side preflight (`verify-teb232-alu-v5-readiness.ts`) proves the
fail-closed path on the real `cbam-desk` case:

```
PREFLIGHT_MODE=release → PREFLIGHT_RESULT=RELEASE_ACCEPTANCE_CASE_NOT_READY → exit 1
EXPECT_BLOCKED=1 + EXPECTED_BLOCKER_IDS=… → DIAGNOSTIC_EXPECTED_BLOCK_MATCHED → exit 0
```

## Honest status

```
LOCAL_CI_GATE=PASS
GITHUB_CI_GATE=PASS
FINAL_COMMITS_PUSHED=YES
PR_OPENED=YES
MERGE_READY=NO (owner decision pending)
DEPLOY_READY=NO
```

GitHub Actions (PR #80, head `7311fcd`): all 8 checks green —

```
regression-test=PASS (typecheck + full vitest + Next build + live critical-flow E2E)
Typecheck, tests and production build=PASS
property-tests=PASS
Trivy repository gate=PASS
Trivy=PASS
Production dependency audit=PASS
Classify release risk and required evidence=PASS
actionlint and policy guard=PASS
```

Two pre-existing `main` CI defects were fixed on this branch so the gate could
close: the Regression Guard referenced a never-declared `test:e2e:critical`
script (now wired to `critical-flows.spec.ts`) and installed only Chromium while
the config also runs WebKit. A stale `tests/engine/dimensional-safety.test.ts`
asserting the pre-FAZ-4 semantic for `totalEmbeddedEmissions` was realigned to
the A–H model (G = certificate-relevant priced; H = informational) that both the
lib preview and server SSOT engine implement.

```
REPORT_STATUS=CONDITIONALLY_READY_FOR_PR
LOCAL_IMPLEMENTATION=SUBSTANTIALLY_COMPLETE
REMOTE_VERIFICATION=COMPLETE (PR #80, all checks PASS)
CURRENT_RELEASE_DECISION=NO_GO
CURRENT_PR_DECISION=GO
```

**Not production-ready and explicitly NOT claimed:** live deployment, browser
E2E on a complete data-ready case, and external verifier acceptance are open
(IL-02, IL-31). No `GLOBAL_PREMIUM` / `VERIFIER_READY` / `10/10` /
`449 USD VALUE VALIDATED` claims are made until the external acceptance gate
closes.
