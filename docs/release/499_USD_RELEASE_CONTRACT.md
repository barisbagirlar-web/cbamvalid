# CBAMValid 499 USD Release Contract

Contract ID: `CBAMVALID-499-RELEASE-1`

Status: **FROZEN**

This contract is the only acceptance basis for declaring the Premium Dossier package ready for sale at USD 499. A source-code change, passing unit test, successful merge, or successful deployment is not completion by itself. Completion requires an artifact-bound evidence bundle generated from the exact release commit.

## Mandatory gates

| Gate ID | Gate | Pass condition |
|---|---|---|
| `G01_INTERNAL_CONSISTENCY` | Internal consistency | Cross-page contradictions are zero. Executive counts, findings, period restrictions, verifier status and premium chapter wording agree. |
| `G02_RECOMPUTATION` | Calculation | Recomputed values and the sealed calculation trace have zero delta. Calculation root hashes agree. |
| `G03_EVIDENCE` | Evidence | Every material input has supporting evidence or an explicit accepted methodology basis. No material D, E, pending, missing, out-of-period or integrity-failed evidence remains. |
| `G04_VERIFIER_BOUNDARY` | Verifier boundary | Pending verifier fields displayed as `Passed` equals zero. Verifier-reserved work is explicitly pending. |
| `G05_LEGAL_SOURCE` | Legal source | Each controlled requirement maps to one correct legal source. Verification/report-template controls use Implementing Regulation (EU) 2025/2546; calculation and monitoring-methodology controls use Implementing Regulation (EU) 2025/2547. |
| `G06_PACKAGE_INTEGRITY` | Package integrity | Manifest, component count, file paths, hashes, byte sizes, media types, signature and reopened ZIP checks pass. |
| `G07_USABILITY` | Usability | The eight-step workflow contract, field guidance, deterministic validation and end-to-end package generation pass without an expert-support dependency. |
| `G08_OUTPUT_QUALITY` | Output quality | No clipping, overflow, broken replacement glyph, wrong heading, empty page, missing outline or meaningless low-content page exists in the primary PDF. |
| `G09_COMMERCIAL_VALUE` | Commercial value | The frozen conservative equivalent-work model is at least 16 hours and at least USD 2,500, and every mapped automated deliverable exists in the sealed package. |
| `G10_P0` | P0 defects | Release-gate P0 defect count is zero. Case-specific working-file restrictions are disclosed data states, not software-release P0 defects. |

## Price decision formula

```text
499_USD_RELEASE_READY =
  all mandatory gates PASS
  AND release P0 defect count = 0
  AND conservative equivalent value >= USD 2,500
```

## Artifact provenance rule

A completion report is forbidden unless all of the following are recorded in `release-evidence.json`:

- exact source commit SHA;
- contract ID and contract SHA-256;
- generation timestamp;
- primary PDF SHA-256;
- sealed ZIP SHA-256;
- manifest SHA-256;
- per-gate status and evidence;
- final `releaseReady: true`.

The evidence bundle must be produced by GitHub Actions from the exact merge commit that will be treated as the release candidate. A PR-head artifact cannot be substituted for the merge-commit artifact.

## Change control

No subjective criterion may be added during evaluation. Any future change requires a new contract ID, explicit rationale and a separate approval. Existing artifacts remain evaluated under the contract version embedded in their evidence bundle.
