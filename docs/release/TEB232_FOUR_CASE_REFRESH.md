# Teb232 Four-Case Refresh

This controlled operation replaces only the four obsolete Teb232 synthetic test working files with current, complete and seal-ready iron-and-steel, cement, aluminium and fertiliser cases.

Payment and Paddle are outside this operation. The existing exact-email test-administrator entitlement remains unchanged.

## Dry run

```bash
npx tsx scripts/refresh-teb232-four-complete-cases.ts
```

## Apply

```bash
EXECUTE=1 npx tsx scripts/refresh-teb232-four-complete-cases.ts
```

The command validates all four replacements before changing data, backs up the exact old Firestore and Storage state, verifies evidence hashes and case readiness after write, and restores the prior test state if the refresh fails.
