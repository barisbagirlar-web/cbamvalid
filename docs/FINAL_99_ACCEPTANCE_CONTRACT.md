# CBAMValid Premium Verification Preparation Package — Final 9.9 Acceptance Contract

Status target: **9.9/10 technical acceptance** for the commercial premium package priced at **USD 449**.

This contract is intentionally fixed. New acceptance criteria must not be invented after a candidate satisfies this document; changes require an explicit contract revision with a new version.

## Final acceptance gates

A candidate is accepted only when all of the following are true for the exact candidate SHA:

1. **Cross-artifact consistency — PASS**
   - Calculation Trace, Calculation Graph, Verifier Workspace, PDF and machine-readable package values agree within the declared numeric tolerance.
   - Direct, indirect, precursor, disclosed, priced, allocation, production, specific-emissions and carbon-price semantics reconcile.

2. **Cryptographic integrity — PASS**
   - Manifest paths, byte sizes and SHA-256 values match package bytes.
   - Detached manifest signature verifies against the published verification identity.
   - ZIP/package contents match the controlled component contract.

3. **Independent recomputation — PASS**
   - Formula-driven Verifier Recompute worksheet is present.
   - Recomputed canonical values reconcile with zero material variance.
   - No spreadsheet formula errors are accepted in verifier-critical cells.

4. **Regulatory and evidence lineage — PASS**
   - Evidence → input → calculation lineage is materialised for assessed material inputs.
   - Registry mappings reference evaluated requirement IDs.
   - No false `REQUIREMENT_NOT_EVALUATED` residue is accepted for operator-complete mapped requirements.
   - Independent-verifier-reserved fields remain separate from operator readiness.

5. **Single commercial truth — PASS**
   - Operator preparation, evidence assurance, package integrity and independent verifier completion are separate metrics.
   - Reporting-period eligibility is anchored to immutable package generation time.
   - Controlled synthetic demonstrations are visibly labelled as non-real and not for regulatory reliance.
   - Manifest top-level component count and hashed-entry count are not conflated.

6. **Language / presentation guard — PASS**
   - Production-facing controlled product output remains English-only where the product contract requires English.
   - Turkish or other accidental fixture/development copy must fail the English-only guard before release.

7. **Security release blocker — PASS**
   - Root production dependency audit: zero HIGH/CRITICAL findings.
   - Cloud Functions production dependency audit: zero HIGH/CRITICAL findings.
   - No `npm audit fix --force` is permitted as an acceptance shortcut.

8. **Build and regression — PASS**
   - Strict typecheck.
   - Cloud Functions build.
   - Next.js production build.
   - Repository CI gate.
   - Premium report/package frozen contracts.
   - Critical-flow regression tests.

9. **Exact artifact evidence — PASS**
   - Acceptance evidence records the exact candidate SHA.
   - The 499 USD artifact-bound release guard generates and validates the exact PDF/ZIP candidate artifacts.
   - Verifier-status single-truth enforcement passes against the generated PDFs.

10. **Production deployment rule**
    - Merge is mandatory before deploy.
    - If runtime code or runtime dependencies did not change, no production deploy is performed.
    - If runtime code or runtime dependencies changed and are not already live, deploy only the affected production surfaces and verify them after deployment.

## Acceptance statement

When all gates above pass for the exact merged and, where required, deployed candidate:

> **CBAMValid Premium Verification Preparation Package — 9.9/10 technical acceptance.**  
> Production artifact cross-artifact verification PASS, cryptographic integrity PASS, recomputation PASS, regulatory/evidence lineage PASS, zero critical inconsistency and zero HIGH/CRITICAL release-blocking defect.  
> Under these conditions, **USD 449 is technically supportable and is not excessive on product-quality grounds**.

This is a technical-product acceptance statement. It does not claim accredited verification, customs acceptance, legal approval, or proof of market willingness-to-pay.