---
applyTo: "lib/cbam/**/*.ts,functions/src/cbam/**/*.ts,tests/cbam-engine/**/*.ts,tests/reports/**/*.ts"
---

Treat CBAM calculations and generated reports as release-critical scientific software.

- Preserve dimensional consistency. Record raw values, normalized values, units, conversion factors, ruleset, engine version and rounding policy.
- Distinguish missing, null and explicit zero. Never use truthy fallback logic where zero is valid.
- Test zero denominators, negative inputs, extreme values, reporting-period boundaries, allocation reconciliation, precursor handling and double counting.
- Expected golden values must be calculated independently of the production function under test.
- Any formula change requires sector fixtures, deterministic reproduction, property tests and report cross-format reconciliation.
- Do not describe internal hashes as accredited verification or regulatory approval.
- Failed validation or report generation must not create a sealed release or consume a report use.
