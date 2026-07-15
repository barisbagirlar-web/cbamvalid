# CBAMValid repository instructions

CBAMValid is a Next.js 16, React 19, TypeScript and Firebase application for preparing CBAM exporter verification dossiers. The site is English-only.

## Product rules

- The commercial product is the Exporter Verification Preparation Pack: one installation, one reporting year, defined production processes and linked goods/CN groups.
- The system prepares evidence and reports for independent verification. Do not claim accredited verification, customs approval, EU approval, official Registry approval or guaranteed acceptance.
- Draft creation may occur before payment. A successful seal consumes one of five report versions. Failed, blocked or repeated downloads consume zero uses.
- Authorization is enforced server-side. Client state is never the security boundary.
- Preserve tenant isolation for cases, evidence, reports, releases, credits, ledger entries, entitlements and storage objects.
- Do not commit environment files, credentials, private keys, tokens or customer evidence.

## Architecture

- Public routes use `app/(public)/layout.tsx` and `PublicHeader`.
- Authenticated routes use `app/(workspace)/layout.tsx` and `AppHeader`.
- Workspace navigation is `/cbam`, `/cases`, `/reports`, `/cbam/methodology`.
- Client Firebase code is in `lib/firebase/client.ts`; Admin SDK code is in `lib/firebase/admin.ts` and must remain server-only.
- Calculation, validation and report generation are under `lib/cbam/` and `functions/src/cbam/`.
- Commerce, payment, ledger and entitlement logic are under `lib/commerce/`, `functions/src/commerce/`, `app/api/checkout/` and `app/api/webhooks/`.

## Working method

1. Read `AGENTS.md` and the nearest applicable instruction file before editing.
2. Trace callers, imports, API boundaries, storage paths, authorization, error propagation and tests before changing a module.
3. Fix root causes and add a regression guard for each production defect.
4. Do not weaken tests to match an implementation. Expected calculation results must be independent of the production function under test.
5. For numeric changes, verify units, dimensions, null/zero distinction, zero denominators, negative/extreme values, allocation reconciliation, double counting, rounding order and deterministic reproducibility.
6. Do not deploy, alter production configuration or perform destructive cloud operations unless explicitly requested.
7. Never report `PASS` without command output, exit code and relevant artifact or runtime evidence. Use `NOT_PROVEN`, `NOT_IMPLEMENTED`, `FAIL` or `EXTERNAL_BLOCKER` when appropriate.

## Validation sequence

```bash
npm ci
npm run guard:workspace-navigation
npm run guard:github-actions
npm run typecheck
npm run lint
npm run test:auth
npm run test:commerce
npm run test:cbam-engine
npm run test:reports
npm run build
```

Calculation changes also require deterministic property tests and independent golden fixtures. Auth, commerce, sealing or tenant-isolation changes require targeted integration and browser evidence before production acceptance.

## Reporting

Summarize root cause, changed components, affected flows, commands with exit codes, commit SHA, unresolved blockers and whether deployment was performed. Code completion is not production completion.
