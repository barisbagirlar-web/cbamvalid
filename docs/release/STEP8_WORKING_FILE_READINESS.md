# Step 8 Working-File Readiness Contract

## Decision

Operator working-file generation and independent-verifier handover are separate gates.

- `isEligibleForSealing` / `canSeal`: operator-controlled working file may be generated.
- `isReadyForIndependentVerification` / `recommendedDecision`: strict verifier-handover posture.
- Every generated package remains `independentVerifierStatus: NOT_REVIEWED` until an external verifier acts.

## Working-file blocking conditions

The file remains blocked when any of these conditions exists:

1. Missing material input or missing supporting record.
2. Rejected evidence or rejected methodology decision.
3. Malware status other than `CLEAN`.
4. Invalid SHA-256, zero byte size, cross-tenant/case path, broken linkage or unsupported evidence.
5. Invalid or missing reporting-period dates, including invalid chronology.
6. Interim, quarterly, partial-year or custom reporting period used for a definitive seal.
7. Calculation, allocation or evidence-integrity blocker.

The following conditions do not block an explicitly conditional operator working file:

1. Customer-organisation review is `PENDING` while the underlying support is present, linked, clean and structurally valid.
2. A structurally complete annual reporting period has not yet ended.

Those conditions continue to block independent-verifier handover and produce `DO_NOT_SUBMIT`.

## Invariants

- Persistent evidence and methodology review states are never mutated by the policy.
- `REJECTED` is never promoted.
- Self-approval remains prohibited by the server authorisation layer.
- Payment entitlement consumption remains after server-side readiness preflight.
- The package retains open findings and `NOT_REVIEWED` status.
- Partial/interim/custom periods cannot use the conditional annual-period exception.

## Test matrix

| Scenario | Working file | Verifier handover |
|---|---:|---:|
| Pending organisation review, otherwise valid | Allow conditionally | Block |
| Future end date on structurally complete annual period | Allow conditionally | Block |
| Quarterly/partial/custom period | Block | Block |
| Rejected evidence | Block | Block |
| Malware uncleared | Block | Block |
| Invalid period chronology | Block | Block |

## Rollback

Revert the commits on branch `fix/step8-working-file-readiness` or revert the merged pull request. No schema migration or irreversible data mutation is introduced.
