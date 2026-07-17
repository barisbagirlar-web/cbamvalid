# Task List — CBAM PDF V16 Quality Gates & Spacing Fixes

- `[ ]` Step 1: Update `methodology()` checklist spacing in `pdf-builder.ts`
  - Checklist card height: 58mm, starting Y: 213, spacing: 5.5mm
- `[ ]` Step 2: Fix duplicate `"Rule:"` label prefix in `auditTrace()` inside `pdf-builder.ts`
- `[ ]` Step 3: Implement dynamic/fallback `exchangeRate` and `converted from` label in `carbonPrice()` inside `pdf-builder.ts`
- `[ ]` Step 4: Extend `guard:calculation-trace` in `scripts/guard-release-mandate.mjs`
  - Check trace nodes inputs string does not contain `"[object Object]"`
  - Check trace ruleBasis does not contain duplicate `"Rule: Rule:"`
  - Generate mock PDF dossier buffer and verify it contains `"converted from"`
- `[ ]` Step 5: Compile, run reports tests, execute sealing validation, and deploy functions
