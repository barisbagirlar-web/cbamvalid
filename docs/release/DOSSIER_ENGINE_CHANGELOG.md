# CHANGELOG — Enterprise Dossier Engine

## 2026-07-29 — Structural remediation (in progress)

### Defect → root cause → fix → customer impact

| Defect | Root cause | Fix | Customer impact |
|--------|------------|-----|-----------------|
| Steel SEE = direct+indirect | RC-2 no Annex II rule | `sectors.rules` + `specificEmbeddedEmissions` → SEE_priced direct-only | Certificate obligation no longer overstated 50% for Annex II |
| DE→NL 100/100 score | RC-3/RC-2 no origin gate | `origin.rules` hard-block + QC_00_ORIGIN + seal refuse | Intra-EU cases cannot seal |
| Truncated calc IDs | RC-1 string concat | `nodeId()` + `buildCalcGraph` merkle | Trace IDs valid; root recomputable from graph |
| One .txt = 18 Supported | RC-3 link-counting | MIME/class + concentration + diversity binder | Evidence score collapses for S0176-class packages |
| Perfect score with empty chapters | RC-3/RC-4 | Honest three-figure score + content contracts | No silent 100/100 on empty boundary prose |
| Invented FIPS L3 | RC-4 hardcoded claims | KMS protectionLevel-derived claims | Crypto claims match key class |
| Incomplete L0–L6 pipeline | RC-1 | `normalizeCase` → graph → bindEvidence → score → `assembleDossier` wired into seal | SSOT DossierModel begins to drive seal |

### Still open (DoD not closed)

- Full CI gate suite (layers, orphans, placeholders, recompute, snapshots)
- RFC3161 TSA + public `/verify/{packageId}` integrity API
- Full offline recompute CLI + PDF number cross-check
- Enterprise chapters E-01…E-16
- Human `[MISSING]`: IR bibliography fields, Annex III territories, `tiers.dataset.json`
- Prior sealed package delta + free re-issue
- Live SSR cutover (Cloud Run CPU quota EXTERNAL_BLOCKER)


## 2026-07-29b — Gates + WP-11/12/14 + Part D contracts
- gate:dossier-all PASS (layers, orphans, placeholders, fixtures, version-literals, id-integrity, recompute, dimension-backing, crypto, legal-refs, no-render-math)
- Calculation Graph.json in package; offline CLI merkle recompute
- /api/verify/package/{packageId} + public pages
- Enterprise chapter content contracts E-01..E-16 + PDF DATA GAP table
- Honest scoreboard + one-line footer in PDF
- TSA binding fail-closed ABSENT until TSR bytes configured
- Human [MISSING] tiers/EUR-Lex/Annex III territories unchanged (null)
