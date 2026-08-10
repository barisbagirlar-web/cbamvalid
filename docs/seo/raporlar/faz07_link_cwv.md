# FAZ 07 — Internal link equity / Core Web Vitals control report

Status: CODE SCOPE COMPLETE / PUBLIC-PROXY MEASUREMENT PARTIAL

## 1. Exact-build link graph

The Phase-07 runtime gate crawled the exact Next.js production build rather than source files alone.

- Indexable/sitemap routes: 43
- Successfully fetched: 43
- Orphan definition: `internalLinksIn < 2 distinct indexable sources`
- Orphans: 0
- Orphan ratio: 0%
- Configured warning threshold: 10%
- Missing governed registry edges after remediation: 0

The crawler has bounded server/fetch lifecycles so a stuck route or orphan child process cannot hold CI indefinitely.

## 2. Revenue-oriented link improvements

Nine verified public CN detail pages now expose deterministic related-CN links. The ring design prevents link equity from accumulating only on the first entries of a sorted list and gives every current Stage-1 CN detail multiple distinct sibling inbound sources.

Each CN detail also realizes its governed link to `/cbam-cn-code-scope`. Code-derived graph centrality for that scope guide moved from approximately `0.0050331886` before the implemented edge set to `0.0060834470` after implementation. This is a graph-centrality result only; it is not represented as search traffic, ranking, conversion or revenue lift.

## 3. Anchor quality

Anchor concentration uses only contextual links; repeated `<header>`, `<nav>` and `<footer>` chrome is excluded from the concentration sample while those links still count for inbound/orphan/PageRank calculations.

Concrete UX/SEO defects were removed:
- Regulatory guide related links no longer expose raw `/cbam-*` paths.
- `/answers` route chains use governed route labels.
- `/glossary` related pages use governed route labels.

The final measured inventory still records 28 targets above the configured 30% contextual concentration threshold. These are retained as visible WARN evidence because many are semantically exact product, policy, guide or CN-code anchors. Artificial synonym rotation was deliberately rejected; hiding a warning by weakening meaning would reduce quality rather than improve it.

## 4. Field CWV truth boundary

No connected CrUX/PSI field-p75 dataset is available in the execution environment.

Result: `SKIP_NO_DATA` under E-35.

The implementation explicitly refuses lab metrics as field truth. Executable negative coverage proves:
- field LCP/INP/CLS breach + no remediation PR → BLOCK;
- field breach + remediation PR reference → WARN;
- lab-only input → `SKIP_NO_DATA`.

Configured field thresholds remain:
- LCP p75: 2500 ms
- INP p75: 200 ms
- CLS p75: 0.1

## 5. Invariants

- INV-7.1 — PASS: 0% orphan ratio.
- INV-7.2 — SKIP_NO_DATA: field dataset unavailable; negative fail-closed fixture PASS.
- INV-7.3 — PASS as control: concentration detector and remediation are executable; residual natural WARN inventory remains visible in `data/seo/link_equity.json`.
- INV-7.4 — PASS: deterministic normalized PageRank-like analysis and implemented centrality evidence.

## 6. Deployment

Runtime/public output changed on CN detail, answer-bank, glossary and regulatory-guide surfaces.

Decision: **DEPLOY AFTER MERGE / EXTERNAL RELEASE EXECUTION**.

The connected tool surface does not expose a safe generic production dispatcher that accepts the exact merged SHA. Existing one-shot deployment workflows are pinned to unrelated accepted SHAs and must not be reused.

ROLLBACK: revert the exact Phase-07 merge commit and publish that rollback SHA only if a runtime regression requires emergency reversal.
