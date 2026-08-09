# PHASE 04 DELIVERY REPORT — Rendered Parity / Commercial SSOT

Status: **COMPLETED CANDIDATE — CODE SCOPE**  
Generated at: `2026-08-09T21:19:00Z`  
Branch: `seo/faz-04-rendered-parity-commercial-ssot`

## 1. Gate-In

- [Kesin] Phases 00–03 are merged.
- [Kesin] E-40 is merged: Phase-04 V6 CI must execute the Chromium browser-render gate on the exact PR head.
- [Kesin] Playwright is already a repository dependency; no new package is introduced.
- [Eksik_veri] GSC/GA4 field-user INP data remains unavailable. Browser correctness is not represented as real-user CWV performance.

## 2. Revenue-Critical Defects Corrected

### 2.1 Obsolete price could pass the rendered SEO guard

Previous crawler behavior accepted the current `PRICE_CLAIM` **or** a literal `149` on money routes and schema checks. That made a stale commercial rollback capable of remaining green.

Correction: rendered price validation accepts only values derived from the current pricing SSOT (`PRICE_CLAIM` → `CANONICAL_PRICING`). No old-price exception exists.

### 2.2 Product and pricing copy duplicated the list price

`/product` contained repeated `USD 449` literals and `/pricing` contained a hard-coded `USD 449` FAQ answer.

Correction: all those values now render from `CANONICAL_PRICING.currency` and `CANONICAL_PRICING.displayPrice`. Conformance rejects duplicated numeric list-price literals on the critical product/pricing/SEO registry sources.

### 2.3 Pricing metadata duplicated the list price

`lib/seo/registry.ts` repeated `USD 449` in the pricing title and description.

Correction: pricing title/description are templated from `CANONICAL_PRICING`. Future commercial price changes propagate through visible copy, metadata, schema claims and rendered checks from one source.

### 2.4 Public product-classification page was outside the SEO runtime registry

[Kesin] `app/(public)/product-classification/page.tsx` is a real self-canonical public commercial page and is linked from the homepage and pricing page, but it was absent from `SEO_ROUTE_REGISTRY` and therefore absent from the registry-derived sitemap/render contract.

Correction:

- add `/product-classification` as indexable + sitemap eligible,
- align title/description/H1 to the actual page,
- record only real internal targets (`/demo`, `/pricing`, `/terms`),
- use factual lastmod `2026-08-04`, supported by the path's Git history,
- add actual homepage/pricing inbound links to registry link contracts.

No synthetic freshness timestamp was invented.

### 2.5 Critical homepage registry positioning was stale

The runtime registry still described the homepage with the older evidence-report positioning while the live page had already moved to self-service emissions-data software.

Correction: homepage title, description, H1 and primary intent now match the current visible product positioning. Product/pricing H1 contracts are also aligned to their current visible headings.

## 3. Executable Browser Proof

`scripts/seo/crawl-rendered.ts` now exports testable pure validators and, when `SEO_RENDER_BROWSER=1`, launches Chromium against the exact production build.

Critical routes:

- `/`
- `/pricing`
- `/product`
- `/product-classification`
- `/methodology`
- `/cn-code`

For each route CI compares raw HTTP HTML with the hydrated Chromium DOM:

- title,
- description,
- H1 text set,
- canonical,
- complete hreflang set,
- current commercial price on money routes.

Browser page errors are BLOCK.

English-only behavior is explicit: an empty hreflang set is valid; browser hydration may not invent a locale cluster.

## 4. Static Public Route Governance

The crawler recursively discovers static `app/(public)/**/page.tsx` routes and excludes dynamic `[segment]` pages.

An index-capable public route must exist in `SEO_ROUTE_REGISTRY`. One narrow exception is permitted for utility surfaces that deliberately use the exact `generateSeoMetadata("<same-path>")` fallback while remaining outside the registry. Those routes are not silently trusted: the crawler must prove both raw HTTP and Chromium-hydrated output remain `noindex`, and the route must stay outside the sitemap.

This rule correctly classifies `/verify/package`: it is a thin package-integrity utility, not a search landing page. Its source uses `generateSeoMetadata("/verify/package")`; because no registry identity exists, the metadata factory fails closed to `noindex,nofollow,noarchive,nosnippet`. Git history shows the utility was introduced on `2026-07-28`; no artificial sitemap/index identity is created.

Any new static public page that is neither registry-governed nor an exact fail-closed metadata utility is BLOCK.

## 5. Build Reuse Without Double Compilation

`scripts/seo/run-rendered-gate.sh` now supports `SEO_SKIP_BUILD=1`.

- Standalone/local invocation still builds by default.
- Phase-04 V6 CI reuses the exact-head production build already completed in the same job.
- `SEO_SKIP_BUILD=1` fails with configuration exit if `.next` is missing.

This removes redundant build time without weakening evidence.

## 6. Invariants

| Invariant | Severity | Result | Evidence |
|---|---|---|---|
| INV-4.1 | BLOCK | PASS candidate | raw↔hydrated title/description/H1 parity + current-price SSOT + registry-or-fail-closed-noindex static-public governance; exact negative fixtures |
| INV-4.2 | BLOCK | PASS candidate | raw↔hydrated canonical/hreflang equality; exact negative fixtures |
| INV-4.3 | WARN | SKIP_NO_DATA | [Eksik_veri] real-user INP p75 unavailable; no lab→field substitution |
| INV-4.4 | INFO | SKIP_NO_DATA | [Eksik_veri] soft-navigation INP telemetry unavailable |

Machine result: `data/seo/invariant-results/faz-04.json`.

Negative fixtures:

- `tests/conformance/inv-4-1.test.ts`
- `tests/conformance/inv-4-2.test.ts`

Positive suite: `tests/conformance/phase04-rendered.test.ts`.

## 7. Red-Team / Failure Modes

### A — Price changes in checkout but public copy stays stale

Mitigation: public product/pricing/registry copy derives from `CANONICAL_PRICING`; rendered gate requires the current SSOT token.

### B — A new public landing page is launched but never enters sitemap governance

Mitigation: filesystem static-public discovery requires registry membership unless the source uses the exact fail-closed metadata fallback. Unknown/unclassified routes are BLOCK.

### C — A thin utility accidentally becomes indexable

Mitigation: any unregistered utility accepted by the source-pattern rule is crawled in raw HTML and Chromium; either becoming indexable or leaking into the sitemap is BLOCK.

### D — Client hydration mutates canonical or injects fake hreflang

Mitigation: Chromium exact parity against raw HTML on critical routes. Any canonical/hreflang set difference is BLOCK.

### E — Client-only rendering removes critical H1/title/description

Mitigation: raw/hydrated critical snapshot equality. Page-level browser exceptions are also BLOCK.

### F — CI appears green without actually running the browser gate

Mitigation: E-40 Phase-04-only workflow step invokes Playwright + `run-rendered-gate.sh`; Phase 04 is not complete without that job step succeeding on exact head.

## 8. Acceptance

Required exact-head gates:

1. Phase-aware V6 preflight `faz-04`.
2. Strict typecheck.
3. Production build.
4. Existing security/release/SEO guards.
5. Vitest conformance + INV-4.1/4.2 negative fixtures.
6. Playwright Chromium install.
7. `SEO_SKIP_BUILD=1 SEO_RENDER_BROWSER=1 bash scripts/seo/run-rendered-gate.sh`.
8. Repository regression/E2E acceptance workflows.

## 9. Deployment

**DEPLOY AFTER MERGE / EXTERNAL RELEASE EXECUTION** — public product/pricing content, registry-derived sitemap and rendered SEO behavior change. Current connected tools do not expose a safe exact-SHA production dispatcher; existing one-shot release workflows are pinned to other accepted SHAs. This is external release execution, not remaining code implementation debt.

## 10. Rollback

ROLLBACK: revert the Phase-04 PR and deploy the exact rollback SHA only for emergency runtime regression. Steady-state rollback reopens price-drift and public-route-governance defects and is not compliant.
