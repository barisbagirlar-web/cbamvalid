# PHASE 03 DELIVERY REPORT — Sitemap / Robots / Index State

Status: **COMPLETED CANDIDATE — CODE SCOPE**  
Generated at: `2026-08-09T20:28:00Z`  
Branch: `seo/faz-03-sitemap-robots-index-state`

## 1. Gate-In

- [Kesin] Phase 02 is merged.
- [Kesin] E-39 removed the systemic negative-fixture write-contract blocker before Phase 03 implementation.
- [Kesin] Sitemap remains derived from the existing runtime SEO registry; no second sitemap inventory is introduced.
- [Eksik_veri] Private GSC cohort-indexation/history data is unavailable. Measurement-only INV-3.4b and INV-3.6 remain `SKIP_NO_DATA`; no indexation ratio or SLO observation is fabricated.

## 2. Runtime / Crawl Corrections

### 2.1 Deterministic sitemap

`app/sitemap.ts` now exports `buildSitemapEntries()` and:

- sorts entries by canonical path before emission,
- emits only `listSitemapRoutes()` records,
- emits no priority/changeFrequency,
- emits `lastModified` only when `factualLastModified` exists,
- converts date-only facts to explicit UTC midnight instead of environment-local parsing.

### 2.2 Robots single source of truth

`app/robots.ts` now owns two explicit contracts:

- `PRIVATE_ROBOTS_DISALLOW`
- `PUBLIC_CRAWLER_USER_AGENTS`

Every configured crawler group receives the same private-route boundary:

- `*`
- `OAI-SearchBot`
- `Googlebot`
- `GPTBot`
- `ClaudeBot`
- `Google-Extended`

The private prefix remains `/cbam/`, not `/cbam`, so public authority pages such as `/cbam-default-values` are not accidentally blocked.

### 2.3 Static Firebase robots fallback is generated, not manually duplicated

`scripts/seo/sitemap-robots-sync-v6.ts` deterministically renders the static `public/robots.txt` fallback from `app/robots.ts` and byte-compares the checked-in file.

This removes silent runtime/static drift while retaining the Firebase Hosting fallback required by the existing architecture.

### 2.4 Parameter/index identity policy

`data/seo/parameter_decisions.json` records path-only canonical identity for:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_term`
- `utm_content`
- `fbclid`
- `gclid`
- `msclkid`
- `ref`

Unknown query parameters also do not create a separate search identity under the current public architecture. Query-bearing URLs are never sitemap entries.

## 3. Machine Controls Added

### `scripts/seo/sitemap-audit-v6.ts`

Checks:

- exact sitemap ↔ indexable registry URL-set parity,
- duplicate sitemap URLs,
- robots-vs-sitemap conflicts for every crawler group,
- canonical sitemap declaration,
- noindex routes excluded from sitemap,
- factual lastmod exactness,
- future-lastmod rejection,
- parameter decision coverage,
- static robots fallback parity.

Exit behavior follows V6: BLOCK → 1, WARN → 2, PASS → 0.

### Negative fixtures

- `tests/conformance/inv-3-1.test.ts`
- `tests/conformance/inv-3-2.test.ts`
- `tests/conformance/inv-3-3.test.ts`
- `tests/conformance/inv-3-4a.test.ts`

Positive suite: `tests/conformance/phase03-sitemap.test.ts`.

## 4. Invariant State

| Invariant | Severity | Result | Evidence |
|---|---|---|---|
| INV-3.1 | BLOCK | PASS candidate | sitemap is exactly the canonical URL projection of `listSitemapRoutes()`; duplicate/missing fixture blocked |
| INV-3.2 | BLOCK | PASS candidate | every sitemap URL checked against every robots group; static fallback must be byte-identical to runtime SSOT |
| INV-3.3 | BLOCK | PASS candidate | noindex registry route in sitemap is rejected |
| INV-3.4a | BLOCK | PASS candidate | lastmod must come from factual source, match exact date and not be future |
| INV-3.4b | WARN | SKIP_NO_DATA | [Eksik_veri] private GSC cohort indexation data unavailable |
| INV-3.5 | WARN | PASS | nine known parameters + unknown policy explicitly produce no independent index identity |
| INV-3.6 | INFO | SKIP_NO_DATA | [Eksik_veri] cohort SLO observation requires private measurement history |

Machine result: `data/seo/invariant-results/faz-03.json`.

## 5. Cross-Phase Dependency — intentionally not bypassed

[Kesin] `/product-classification` is a real public page with self-canonical metadata but remains absent from runtime `lib/seo/registry.ts`.

[Kesin] Phase 03 is forbidden to write `lib/seo/**`. Adding `/product-classification` directly into `app/sitemap.ts` would create a second URL source of truth and violate the registry architecture.

Decision: do **not** add a one-off sitemap exception. Runtime registry alignment is assigned to Phase 04, whose write contract explicitly allows `lib/seo/**` and `app/(public)/**`. Until then sitemap-registry parity remains internally correct rather than being weakened.

## 6. Red-Team / Failure Modes

### Failure mode A — static robots diverges from runtime robots

Effect: Firebase fallback can expose or block a different crawl surface than Next MetadataRoute.

Mitigation: deterministic renderer + byte parity test. Drift is BLOCK.

### Failure mode B — named AI crawler gets broader private access

Effect: workspace/API/private routes can be crawled by a specifically named group even though the wildcard policy is restrictive.

Mitigation: one crawler array mapped to one private disallow array; positive conformance asserts every group receives every private prefix.

### Failure mode C — build time is emitted as lastmod

Effect: meaningless sitemap freshness churn and loss of lastmod trust.

Mitigation: generator accepts only registry `factualLastModified`; future and mismatched dates are BLOCK.

### Failure mode D — query parameters become indexable identities silently

Effect: duplicate crawl/index surfaces and attribution URL pollution.

Mitigation: explicit parameter ledger + path-only canonical resolver tests + sitemap query ban.

## 7. Acceptance

Required exact-head gates:

- phase-aware preflight (`faz-03`),
- strict typecheck,
- production build,
- existing SEO/release/security guards,
- `npm run seo:conformance`,
- four BLOCK negative fixtures,
- positive Phase-03 suite.

## 8. Deployment Decision

**DEPLOY AFTER MERGE** because `app/sitemap.ts`, `app/robots.ts` and `public/robots.txt` alter production crawl responses. In the current connected environment no safe exact-SHA production-dispatch action is available; existing one-shot deploy workflows are pinned to prior releases. Per owner instruction, production publish is therefore external release execution, not remaining code implementation debt.

## 9. Rollback

ROLLBACK: revert the Phase-03 PR and deploy that exact rollback SHA only if a production crawl regression requires emergency rollback. A steady-state rollback would re-open named-crawler private-boundary and robots-drift risks.
