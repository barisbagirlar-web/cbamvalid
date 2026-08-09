# SEO MASTER MANDATE — V6 ENTERPRISE / CBAMValid EXECUTION KERNEL

Source basis: user-supplied `SEO_MANDATE_V6_TAM_SURUM.md`, SHA-256 `4c3cab1c5364e2f9c8af5a6832708424f59ee7ea95b84e7d6a42f2e9b35b0ca5`.

This repository file is the executable kernel of that mandate. The source mandate remains authoritative for phase intent and terminology. `docs/seo/MANDATE_ERRATA.md` is a binding execution errata layer and MUST be read immediately after this file. Where the source text is mechanically impossible or internally contradictory, the errata applies under AIP-25 and the more restrictive safe interpretation wins.

## 1. Operating model

Phase architecture:

`BOOTSTRAP → 0 Discovery → 1 Registry → 2 Host/Redirect → 3 Sitemap/Robots → 4 Render → 5 Content/Entity → 6 Schema → 7 Links/CWV → 8 Crawl/AI → 9 Warehouse/P&L → 10 Crisis/Migration → 11 KAC/Portfolio → 12 SEO SRE → 13 Off-page/Moat → 14 Intent/CRO → 15 Vertical Modules → 16 TAM/Growth → 17 Portfolio Economics → 18 Programmatic Factory → 19 Valuation`

Normal phase rule: one phase = one branch = one PR. Runtime deployment is a separate decision. A merge does not authorize deployment. When runtime output is unchanged, push/merge is sufficient and deployment is prohibited as unnecessary churn.

### BOOTSTRAP exception

The source requires X.1–X.8 before Phase 0 but originally gives no legal write contract for installing X.1–X.8. V6.1 execution therefore defines a single non-runtime `BOOTSTRAP` phase. Branch: `seo/faz-00-v6-bootstrap-kesif`. It may install only the execution/control-plane files enumerated by `PHASE_CONTRACTS.json`. It MUST NOT modify public runtime application behavior.

## 2. AIP-01…27 — binding

- **AIP-01** One phase = one branch = one PR; BOOTSTRAP is the sole pre-phase exception defined above.
- **AIP-02** No assumptions. Missing decision data must be labeled and execution must stop when the phase requires it.
- **AIP-03** File manifest is binding. Effective write permission is the intersection of the global manifest and active phase contract.
- **AIP-04** Scripts are idempotent.
- **AIP-05** Exit codes: `0 PASS`, `1 BLOCK violation`, `2 WARN threshold`, `3 missing input data`, `4 configuration error`.
- **AIP-06** Deterministic ordering; no randomness without fixed seed.
- **AIP-07** PASS requires machine evidence: command plus stdout/result artifact.
- **AIP-08** Every completed-phase BLOCK invariant requires a negative fixture proving exit/fail behavior.
- **AIP-09** New package requires explicit human approval. Reuse existing dependencies where sufficient.
- **AIP-10** TypeScript strict; no `any`; pure logic plus thin I/O; new V6 scripts support `--dry-run`.
- **AIP-11** Timestamps are UTC ISO-8601. Calendar-only regulatory dates may remain `YYYY-MM-DD`; see errata.
- **AIP-12** Money is integer minor-unit only.
- **AIP-13** No credentials in repository content. Secret discovery is a BLOCK.
- **AIP-14** Automation may open PRs/issues but may not auto-merge, auto-publish content, auto-write production redirects, or deploy production.
- **AIP-15** Scope lock. Unrelated findings go to `BULGULAR_KUYRUGU.md`.
- **AIP-16** Every phase/PR has an explicit rollback statement. Irreversible actions require separate human approval.
- **AIP-17** Evidence claims use `[Kesin]`, `[Güçlü]`, `[Varsayım]`, `[Eksik_veri]`.
- **AIP-18** Silent failures are forbidden.
- **AIP-19** The agent cannot self-approve. Prior explicit owner instructions may satisfy an approval only when recorded verbatim-by-reference in `KARAR_DEFTERI.md` and the condition has actually been met.
- **AIP-20** Reports and commit/PR prose use `site.language`; identifiers follow repository conventions.
- **AIP-21** Priority: legal/ethical and prohibitions → current explicit owner instruction → AIP → site config → phase body → annex/examples.
- **AIP-22** Vertical rules may narrow general rules, never weaken them.
- **AIP-23** Config thresholds win over prose thresholds. Runtime code does not duplicate threshold values.
- **AIP-24** Ambiguity uses the more restrictive interpretation and is logged.
- **AIP-25** Contract defects are written to `MANDATE_ERRATA.md`; do not invent around them.
- **AIP-26** No ranking, traffic, revenue, customs, accreditation, or acceptance promise language in operational/user-facing claims. Policy documents, tests and negative fixtures are excluded from claim scanning to avoid self-triggering.
- **AIP-27** Human-gated actions require `KARAR_DEFTERI.md` with approver, UTC timestamp, decision, scope and rationale.

## 3. Source of truth

Site configuration: `sites/<siteId>/seo.config.json`.
Shared defaults: `seo.config.defaults.json`.
Schema contract: `seo.config.schema.json`.
Phase write locks: `PHASE_CONTRACTS.json`.
Invariant registry: `data/seo/invariants.json`.
Progress: `docs/seo/PROGRESS.md`.

`dataWindowStart` lower-bound enforcement is performed by preflight P-08. JSON Schema Draft-07 string `minimum` is not used because it does not order ISO date strings.

## 4. Global manifest

Global manifest is a superset; phase contracts are the restrictive layer. Allowed families:

- `sites/*/seo.config.json`, `seo.config.defaults.json`, `seo.config.schema.json`, `PHASE_CONTRACTS.json`
- `docs/seo/**`
- `data/seo/**`, `portfolio/**`
- `scripts/seo/**`, `tests/conformance/**`, `.github/workflows/seo-conformance.yml`
- `package.json` when only V6 script wiring changes and no dependency is added
- existing SEO runtime surfaces only in a phase that explicitly authorizes them: `lib/seo/**`, `components/seo/**`, selected `app/**`, `public/robots.txt`, `firebase.json`

Files outside the active phase contract are BLOCK even if they are in this global superset.

## 5. Preflight P-01…P-10

1. Config structural validation.
2. Placeholder scan.
3. Active-phase write-lock check from git diff.
4. Secret-pattern scan over changed text files.
5. Invariant registry structural consistency.
6. Artifact envelope validation for completed-phase artifacts.
7. Budget split sum = 100.
8. `dataWindowStart >= 2025-09-11` by explicit date comparison.
9. `--site` required and must match config `siteId`.
10. Promise/claim scan scoped to user-facing/report surfaces; policy docs and test fixtures are excluded.

## 6. Conformance C-01…C-15

The installed conformance suite must expose these named checks and be progress-aware so not-yet-installed phases do not break early CI:

`artifact-envelope`, `invariant-result-schema`, `no-hardcoded-thresholds`, `phase-writes-lock`, `money-integer`, `guarantee-regex`, `approval-records`, `registry-single-writer`, `negative-tests-exist`, `determinism`, `exit-codes`, `envelope-completeness`, `structural-breaks-join`, `coldstart-flag`, `portfolio-siteid`.

A completed phase may only be marked PASS when all BLOCK invariants for that phase have executable negative coverage.

## 7. Artifact envelope

All generated SEO data artifacts that are not configuration/control files use:

```json
{
  "meta": {
    "artifact": "...",
    "schemaVersion": "6.0",
    "generatedAt": "UTC ISO-8601",
    "generatorScript": "...",
    "inputWindow": {"start": null, "end": null},
    "confidence": "high|medium|low",
    "partial": true,
    "siteId": "cbamvalid",
    "coldStart": null,
    "structuralBreaksApplied": []
  },
  "data": {}
}
```

`coldStart` may be `null` only when GSC history is unavailable and the current phase is blocked on missing measurement access; it may not be guessed. Once measured, it is boolean.

## 8. Merge/deploy release discipline

For every phase:

1. Start from the current immutable `main` SHA; do not reuse unrelated/stale branches.
2. Separate unrelated existing PRs/WIP; do not import them.
3. Preflight → build/typecheck where phase touches buildable code → relevant guards → conformance.
4. Open a dedicated PR with evidence and `ROLLBACK:`.
5. Merge only if the recorded owner approval condition is satisfied and required checks are green.
6. Do not deploy before merge.
7. Do not deploy non-runtime/control-plane-only phases.
8. If runtime changes later become live-required, deploy the exact merged main SHA through the repository's approved Firebase release path and verify live smoke separately.

## 9. Phase 0 mandatory boundary

Phase 0 is discovery only. It may produce `data/seo/tam_map.json`, `docs/seo/raporlar/faz00_baz.md`, invariant results, queue/progress updates. It may not change runtime SEO code. GSC and GA4 access are required by the source Gate-In. If unavailable, record `[Eksik_veri]`, return exit/state 3, and do not manufacture cold-start or business-performance conclusions.

## 10. Existing CBAMValid SEO engine preservation

The repository already contains a merged SEO SSOT, canonical/sitemap/robots controls, rendered crawl tooling, schema graph logic and AEO/LLM feeds. V6 is an execution/control layer over that engine. Existing production SEO code is not rewritten merely to conform stylistically. A later phase may change it only when a measured invariant or approved phase objective requires the change.

ROLLBACK: delete the V6 execution/control-plane files introduced by the BOOTSTRAP PR; no runtime application rollback is required because BOOTSTRAP is non-runtime.