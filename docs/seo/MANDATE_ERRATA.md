# MANDATE ERRATA — V6 → V6.1 EXECUTION CORRECTIONS

Status: BINDING under AIP-25. Read after `docs/seo/MANDATE.md`.

## E-18 — BOOTSTRAP HAS NO LEGAL WRITE PHASE

[Kesin] Source V6 requires X.1–X.8 to be installed before Phase 0 while Phase 0's write contract permits only discovery artifacts. A clean repository therefore cannot legally install the mandate itself.

Permanent correction: introduce non-runtime `BOOTSTRAP` contract in `PHASE_CONTRACTS.json`. It is the only pre-phase exception to AIP-01 and may write only control-plane files. Runtime code is forbidden.

## E-19 — GLOBAL MANIFEST OMITS REQUIRED OUTPUTS

[Kesin] Source X.2 omits paths later required by phase bodies, including `seo.config.schema.json`, `PHASE_CONTRACTS.json`, `docs/seo/PROGRESS.md`, phase reports, redirect ledger, SLO history, calibration output, runbooks/DD package and several phase data products.

Permanent correction: global manifest is the documented superset in `MANDATE.md`; `PHASE_CONTRACTS.json` is the actual restrictive write gate. All phase outputs must have a legal path before the phase begins.

## E-20 — MANIFEST CANNOT MODIFY THE EXISTING NEXT.JS SEO ENGINE

[Kesin] Source X.2 does not authorize `lib/seo/**` or `components/seo/**`, yet later phases explicitly require schema/entity/canonical/runtime corrections. On this repository those are the actual SEO implementation surfaces.

Permanent correction: add existing SEO runtime families to the global superset, but permit them only in phase contracts that require runtime changes. This preserves AIP-03 without making later phases impossible.

## E-21 — FIREBASE HOSTING IS NOT A VALID DEPLOYMENT ENUM

[Kesin] CBAMValid is served through Firebase Framework-Aware Hosting; source V6 only allows `vercel|netlify|cloudflare_pages|static_host`. Encoding the real deployment would otherwise fail config validation.

Permanent correction: V6.1 adds `firebase_hosting` to the deployment target enum. `static_host` is not used as a misleading alias.

## E-22 — DRAFT-07 STRING `minimum` DOES NOT ENFORCE DATE LOWER BOUNDS

[Kesin] Source V6 claims `"minimum": "2025-09-11"` on a JSON string enforces the lower date boundary. Under JSON Schema Draft-07, `minimum` is numeric and does not order strings.

Permanent correction: schema validates ISO date shape; preflight P-08 performs an explicit UTC/date-only comparison and exits 4 if the date is earlier than `2025-09-11`.

## E-23 — PHASE CONTRACT TABLE IS INCOMPLETE BY DESIGN

[Kesin] Source X.4 defines only a subset of phases and says the others are added after Phase 0, while X.4 is itself required before Phase 0 and undefined phase writes cannot pass AIP-03 safely.

Permanent correction: bootstrap installs contracts for BOOTSTRAP and all phases 0–19. Later changes to contracts are normal reviewed changes, not prerequisite creation during execution.

## E-24 — `linkableAsset` TYPE CONTRADICTION

[Kesin] Phase 13 requires registry records to carry `linkableAsset: true`, but the Phase 1 `SeoPageRecord` interface does not define that field.

Permanent correction for Phase 1: add `linkableAsset: boolean` with default `false`; only Phase 1 may persist registry changes.

## E-25 — CONFIG DOES NOT CONTAIN ALL THRESHOLDS USED BY PHASES

[Kesin] INV-X.5/AIP-23 require thresholds to come from config, while multiple phase bodies use thresholds absent from the source config (crawl waste, orphan ratio, anchor concentration, cohort index rate, calibration age/rho/sample, experiment duration, growth coverage bands and others).

Permanent correction: V6.1 CBAMValid config/schema adds named threshold keys for every machine-enforced threshold used by the execution layer. Later code must reference those keys rather than phase prose numbers.

## E-26 — NAIVE GUARANTEE REGEX SELF-BLOCKS POLICY AND NEGATIVE TESTS

[Kesin] The mandate and conformance fixtures necessarily contain forbidden words while describing the prohibition. A repository-wide regex would therefore fail permanently.

Permanent correction: P-10/C-06 scan only claim-bearing surfaces (user-facing app copy, generated reports, PR evidence artifacts) and deliberately exclude mandate/policy documents, test code and negative fixtures. The test suite separately proves that prohibited positive claims are blocked.

## E-27 — NAIVE NUMERIC-LITERAL SCAN CANNOT DISTINGUISH THRESHOLDS

[Kesin] Source C-03 proposes scanning numerical literals while scripts legitimately contain exit codes, array positions, schema versions and protocol constants. A raw numeric grep creates false BLOCKs.

Permanent correction: C-03 scans only V6 SEO execution scripts and compares configured threshold values/known threshold identifiers; protocol constants and ExitCode enum are explicitly not treated as business thresholds. Phase implementations must centralize machine thresholds through the config loader.

## E-28 — INCREMENTAL CI MUST ALSO APPLY TO NEGATIVE COVERAGE

[Kesin] Source X.6 makes script installation progress-aware, but C-09 as written could require negative tests for all 75 BLOCK invariants before later phases exist.

Permanent correction: conformance enforces negative coverage for global/bootstrap invariants and phases marked completed in `docs/seo/PROGRESS.md`; future phase invariants become mandatory when that phase enters `completed` state.

## E-29 — DATE-ONLY REGULATORY FIELDS CONFLICT WITH AIP-11

[Kesin] Existing SEO registry intentionally uses factual `YYYY-MM-DD` dates, while AIP-11 says all dates are UTC ISO-8601. Converting regulatory calendar dates into arbitrary timestamps would reduce semantic accuracy.

Permanent correction: timestamps/events use full UTC ISO-8601; factual calendar dates may use ISO `YYYY-MM-DD`.

## E-30 — COLD-START CANNOT BE GUESSED FROM MISSING ACCESS

[Kesin] Missing GSC access is not evidence of `<28` days of GSC data.

Permanent correction: artifact envelope allows `coldStart: null` only while the Gate-In is blocked for missing measurement data. The moment GSC history is available, `coldStart` must become a measured boolean.

## E-31 — DEPLOYMENT POLICY MUST MATCH CBAMVALID REALITY

[Kesin] The repository has explicit Firebase deployment workflows and prior release records. A control-plane-only SEO change does not alter runtime and must not trigger production deployment.

Permanent correction: BOOTSTRAP and pure data/control phases are merge-only. Runtime phases may deploy only after merge of the exact reviewed SHA and only when the changed runtime is not already live.

## E-32 — SECRET NEGATIVE FIXTURES CAN SELF-BLOCK P-04

[Kesin] The first live V6 CI run failed at P-04 because the negative conformance test contained a contiguous fake private-key marker. A correct secret scanner cannot distinguish that raw marker from an accidentally committed real marker by intent alone.

Permanent correction: security scanning remains strict for all changed text files; negative fixtures construct credential-shaped markers at test runtime from non-matching source fragments. Tests therefore still prove the detector while committed source never contains a credential marker that P-04 must reject.

## E-33 — NEW WORKFLOWS MUST PROVE THE PINNED NODE RUNTIME

[Kesin] The next live V6 run passed preflight, typecheck and production build, then the repository's existing `guard:github-actions` correctly blocked the new SEO workflow because it configured Node 24 without an explicit runtime verification step.

Permanent correction: every V6 workflow that runs Node adds the repository-standard `node --version | grep -E '^v24\\.'` proof immediately after setup. The GitHub Actions guard remains unchanged and therefore continues to detect silent runtime drift.

## E-34 — CI WAS HARD-CODED TO THE BOOTSTRAP WRITE CONTRACT

[Kesin] After BOOTSTRAP merged, the installed SEO workflow still invoked preflight with `--phase bootstrap`. A legal Phase 0 change such as `docs/seo/raporlar/faz00_baz.md` would therefore be tested against the wrong write contract and blocked before Phase 0 could run. The same defect would have broken every later phase.

Permanent correction: PR CI deterministically resolves the active phase from the mandatory branch convention (`seo/bootstrap-*` → `bootstrap`, `seo/faz-NN-*` → `faz-NN`) and passes that exact value into preflight. Manual workflow dispatch requires an explicit phase choice from `bootstrap` or `faz-00`…`faz-19`; unknown branches/phases fail closed with exit 4. This keeps branch naming, phase contract and write-lock mechanically coupled.

## E-35 — PRIVATE MEASUREMENT ACCESS MAY BE UNAVAILABLE WHILE TECHNICAL EXECUTION REMAINS POSSIBLE

[Kesin] The execution environment can prove repository state, live public routes and public sources but currently has no connected Google Search Console or GA4 reporting data provider. Treating that tooling limitation as a permanent stop would prevent technical SEO work whose correctness does not depend on private traffic metrics.

Permanent correction under AIP-21 and the explicit owner decision recorded on 2026-08-09: technical/public-data phases may proceed in **public-proxy mode**. In this mode unavailable GSC/GA4 fields are `SKIP_NO_DATA`; artifacts using proxy/public evidence are `partial: true` and `confidence: "low"`; `coldStart` stays `null` until actual GSC history is measured. Public SERP observations may establish topic/competitor presence but never search volume, ranking, conversion, traffic-lift or revenue-lift claims. Money metrics remain unknown/zero-confidence when conversion value data is absent. Legal/ethical rules and Ek E prohibitions are not relaxed.

Phase completion rule: a phase may be completed when all non-measurement BLOCK invariants pass, every measurement-only unavailable input is explicitly `SKIP_NO_DATA`, no fabricated metric enters the artifact, and the phase's technical Gate-Out is otherwise evidenced. Measurement debt remains open in the findings queue until private reporting access is connected.

## Decision record

These corrections preserve the source mandate's intent: stricter write isolation, machine-verifiable evidence, no invented data, no unnecessary deployment and no weakening of any legal/ethical restriction.
