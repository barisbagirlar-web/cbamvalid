# CBAMValid Rollback and Forward-Recovery Control

Every migration and production release must identify whether rollback is safe. Where sealed artifacts, entitlement consumption, audit records or external payment events are involved, forward recovery is preferred over destructive rollback.

## Required Rollback Plan Fields

1. Related migration/release ID.
2. Trigger conditions.
3. Maximum safe rollback window.
4. Data and Storage backup locations.
5. Code rollback commit.
6. Schema compatibility assumptions.
7. Commands and operator authorization.
8. Validation after rollback.
9. Customer/report impact.
10. Audit and incident records.

## Component Rules

### Authentication

Code rollback is allowed only when session-cookie compatibility and revocation behavior remain correct.

### Evidence

Never delete approved or sealed evidence during rollback. Disable new transitions and preserve physical bytes, generations, hashes and audit events.

### Entitlements

Never decrement a committed successful release count. Failed reservations may be released only through the defined recovery state machine.

### Sealed Reports

Never overwrite, regenerate or delete an already committed immutable release as an ordinary rollback action. Mark a release revoked or superseded while preserving original bytes and audit history.

### Rulesets

Never mutate a published ruleset in place. Deprecate it and publish a corrected version with explicit effective dates and provenance.

### Signing Keys

A compromised or invalid signing key must be disabled through KMS policy. Existing signatures and key-version references must remain available for historical verification.

## Initial Recovery Procedure

If the current recovery branch causes regression before any new data schema is deployed:

1. Stop deployment.
2. Keep `main` unchanged.
3. Revert or abandon the recovery branch.
4. Preserve all audit documents and failure evidence.
5. Do not restore `PRODUCTION_SALES_READY=YES`; the unsupported claim remains invalid independently of implementation rollback.
