# CBAMValid Migration Control

No production data migration may be applied until it has a dedicated plan in this directory and a matching rollback or forward-recovery plan under `docs/rollback/`.

## Required Migration Plan Fields

Each migration document must contain:

1. Migration ID and owner.
2. Affected collections, Storage paths, indexes, claims, APIs and clients.
3. Source and target schemas.
4. Compatibility period and dual-read/dual-write behavior.
5. Pre-migration export/backup procedure.
6. Dry-run command and expected counts.
7. Idempotency strategy.
8. Batch size, retry and rate-limit controls.
9. Validation queries and invariants.
10. Failure modes and recovery actions.
11. Reversibility classification.
12. Production execution evidence.

## Planned Migrations

| ID | Scope | Reversibility | Status |
|---|---|---|---|
| MIG-001 | Typed case revisions and authoritative sealing references | Forward-compatible | NOT_STARTED |
| MIG-002 | Remove customer-controlled verification fields | Forward-compatible with legacy rejection | NOT_STARTED |
| MIG-003 | Evidence metadata, lifecycle, tenant paths and immutable snapshots | Forward-compatible | NOT_STARTED |
| MIG-004 | Five-release entitlement state machine and scope lock | High-risk; forward recovery preferred | NOT_STARTED |
| MIG-005 | Versioned ruleset registry and provenance | Forward-compatible | NOT_STARTED |
| MIG-006 | Immutable report releases, artifact metadata and manifest signature | High-risk; preserve legacy records | NOT_STARTED |
| MIG-007 | Server-managed roles replacing hardcoded admin email | Reversible during compatibility window | NOT_STARTED |

## Mandatory Safety Rules

- Never delete legacy fields in the first deployment.
- New readers must tolerate old records and classify them as legacy/unsealable until migrated.
- Backfills must be idempotent and resumable.
- Entitlement migration must never increase consumed release count or grant a sixth release.
- Legacy sealed artifacts must never be silently reclassified as cryptographically verified.
- Existing reports without immutable bytes or signatures must be labelled `LEGACY_UNVERIFIED`, not upgraded by metadata alone.
