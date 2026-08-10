# Bootstrap Phase 07 runtime-gate extension

[Kesin] E-40 requires future phases with distinct runtime evidence to be added explicitly to the fail-visible V6 runtime-gate map.

Phase 07 requires executable evidence for rendered internal-link economics and the CWV remediation gate. Static conformance alone cannot prove the current built site link graph.

Correction applied in `.github/workflows/seo-conformance.yml`:
- `faz-07` executes `scripts/seo/link-equity.ts --dry-run` after the exact-head production build.
- `faz-07` executes `scripts/seo/cwv-field-gate.ts --dry-run` in the same runtime stage.
- exit `2` remains a visible WARN and does not masquerade as a BLOCK failure.
- exit `1`, `3`, `4`, or any unexpected non-zero code blocks the phase.
- no Phase-07 script is executed during bootstrap; the map becomes active only on a `seo/faz-07-*` PR.

Runtime impact: none. Deployment: none.

ROLLBACK: revert the bootstrap PR; Phase 07 will again lack executable runtime evidence and must not be marked complete.
