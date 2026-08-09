# SEO V6 PROGRESS — cbamvalid

Initial V6 bootstrap branch: `seo/faz-00-v6-bootstrap-kesif`  
Bootstrap base main SHA: `49947001398332e2c26f6a6f1f989ab7800ebf0f`  
Owner public-proxy override merged after PR #179 checks.

| Phase | Status | Evidence |
|---|---|---|
| BOOTSTRAP | completed | PR #175 control plane; PR #177 phase-aware CI; PR #179 owner public-proxy override; PR #185 Phase-02 runtime-owner contract fix; PR #189 legacy G32 contract fix; PR #190 systemic future negative-fixture contract fix; all merged after repository workflow gates |
| FAZ 00 | completed | `data/seo/tam_map.json` + `data/seo/invariant-results/faz-00.json` + `docs/seo/raporlar/faz00_baz.md`; public-proxy partial baseline; private GSC/GA4 fields SKIP_NO_DATA |
| FAZ 01 | completed | PR #182; 45-record `data/seo/registry/cbamvalid_seo_registry.json`; config-driven validator; all five Phase-01 BLOCK invariants have executable negative tests; economics partial because production cost/private measurement data is unavailable |
| FAZ 02 | completed | PR #187, merge `29992892afd33e66b846d6fe166883c7a9106fe5`; canonical origin derived from site config; absolute canonical legacy redirects; HSTS preload removed; redirect ledger and chain/variant/capacity guards; all four Phase-02 BLOCK invariants have executable negative tests; external Firebase/DNS controls excluded from code scope |
| FAZ 03 | completed | deterministic registry-derived sitemap; one robots SSOT plus generated Firebase fallback; all named crawler groups inherit private disallows; parameter decision ledger; truthful-lastmod guard; all four Phase-03 BLOCK invariants have executable negative tests; GSC cohort metrics SKIP_NO_DATA |
| FAZ 04 | pending | rendered parity + runtime registry drift (`/product-classification`) next |
| FAZ 05 | pending | — |
| FAZ 06 | pending | — |
| FAZ 07 | pending | — |
| FAZ 08 | pending | — |
| FAZ 09 | pending | — |
| FAZ 10 | pending | — |
| FAZ 11 | pending | — |
| FAZ 12 | pending | — |
| FAZ 13 | pending | — |
| FAZ 14 | pending | — |
| FAZ 15 | pending | — |
| FAZ 16 | pending | — |
| FAZ 17 | pending | — |
| FAZ 18 | pending | — |
| FAZ 19 | pending | — |

Allowed statuses: `pending | in_progress | blocked | completed`.

A phase is `completed` only after required machine checks, negative coverage and approval conditions are evidenced. Runtime deployment state is tracked separately and is not implied by this ledger.

Deployment decisions:
- BOOTSTRAP/control overrides: **NO DEPLOY** — control-plane only.
- FAZ 00: **NO DEPLOY** — discovery/data/docs only.
- FAZ 01: **NO DEPLOY** — registry/data/scripts/tests/docs only; runtime SEO code is unchanged.
- FAZ 02: **DEPLOY AFTER MERGE / EXTERNAL RELEASE EXECUTION** — runtime `next.config.js` change merged; current connected tools expose no safe exact-SHA production dispatcher and existing one-shot deploy workflows are pinned to older releases.
- FAZ 03: **DEPLOY AFTER MERGE / EXTERNAL RELEASE EXECUTION** — sitemap/robots runtime changes require production publish after merge; same exact-SHA dispatcher limitation applies.

Measurement debt: GSC/GA4 reporting access remains unavailable; E-35 requires measurement-dependent fields to stay `SKIP_NO_DATA`, `partial: true`, `confidence: low`, and `coldStart: null` until measured.
