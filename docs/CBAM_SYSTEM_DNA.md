# CBAM System DNA

## 1. Route Map
- **Public Routes:** `/`, `/login`, `/register`, `/about`, `/contact`, `/privacy`, `/terms`, `/refund-policy`, `/cookie-policy`, `/legal-notice`, `/methodology`, `/cn-code`, `/cn-code/[code]`, `/verify/[documentHash]`
- **Protected User Routes:** `/dashboard`, `/dashboard/reports`, `/dashboard/wizard`, `/cbam`, `/cbam/new`, `/cbam/reports/[reportId]`, `/account`
- **Protected Admin Routes:** `/admin`, `/admin/users`, `/admin/reports`, `/admin/audit`
- **API Routes:** `/api/checkout/cbam`, `/api/cron/source-watchers`, `/api/verify/[documentHash]`, `/api/webhooks/paddle`

## 2. Component Map
- **Layouts:** Root Layout (`app/layout.tsx`), Auth Layout, Protected User Layout (`app/(protected)/cbam/layout.tsx`), Admin Layout.
- **Header:** `AppHeader.tsx` (contains Account Dropdown, Credits display, Admin/User context switching).
- **Forms/UI:** Login/Register forms, `SignOutButton.tsx`, Wizard tab interfaces (`CbamWizardClient.tsx`).
- **Dashboard:** `page.tsx` under `/cbam` mapping out Draft Cases, Sealed Reports, Credits Available.

## 3. API & Functions Map
- **Cloud Functions (europe-west1):**
  - **Account/Admin:** `getAccountOverview`, `updateOwnProfile`, `requestAccountClosure`, `listAllUsers`, `listAllTransactions`, `adminSetUserTokens`
  - **Commerce:** `getEntitlements`, `createCheckoutSession`, `unlockCbamUses`, `paddleWebhook`, `listCreditLedger`, `listPurchaseHistory`
  - **Cases/Dossiers:** `saveCbamCase`, `getCbamCase`, `renameCbamCase`, `archiveCbamCase`, `deleteCbamCase`, `getCbamCases`, `calculateCbam`
  - **Reports/Sealing:** `sealCbamReport`, `getCbamReports`, `getCbamReport`, `getReportDownloadUrl`, `sealRecoveryWorker`
  - **System:** `getSourcesStatus`

## 4. Firestore Schema Map
- **`users/{uid}`:** Profile data, `tokens`, `role` (Admin SDK bypass required for roles).
  - **Subcollections:** `creditSummary` (read-only for clients, managed by backend), `creditLedger`.
- **`cbam_cases/{caseId}`:** Draft case documents. Strict backend mutation.
- **`cbam_reports/{reportId}`:** Immutable sealed reports.
- **`commerce_orders/{orderId}`**, **`entitlements/{id}`**, **`paddle_events/{id}`**, **`account_closures/{id}`**: Backend-managed commercial ledger records.
- **`document_seals/{documentHash}`**: Publicly readable sealed report hashes.
- **`seal_outbox`, `seal_log`, `source_registry_snapshots`, `audit_events`**: Strict backend operational collections.

## 5. Storage Map & Evidence Paths
- **Storage Rules:** Users can read `/reports/{userId}/{reportId}/{allPaths=**}`. Writing is strictly restricted to Backend Admin SDK.
- **Evidence Paths:** Reports and generated PDFs/XMLs are stored using the `reportId` partitioning.

## 6. Case/Report State Machines
- **Current Case State:** Ephemeral draft mapping stored primarily on the client or saved directly. (TARGET FIX: Implement structured states: `DRAFT`, `IN_PROGRESS`, `BLOCKED`, `READY_TO_SEAL`, `SEALING`, `SEALED`, `FAILED`, `ARCHIVED`).
- **Current Report State:** Direct sealing via Cloud Functions. (TARGET FIX: `STAGING`, `SEALED`, `PUBLISHED`, `SUPERSEDED`, `REVOKED`).

## 7. Calculation Dependency Graph
- **Applicability** (`applicability-engine.ts`) -> **Default Values** (`default-value-engine.ts`) -> **Actual Values / Emissions** (`actual-value-engine.ts`) -> **Certificates / Price** (`certificate-engine.ts`).
- Orchestrated by `calculation-engine.ts` into a `calculationTrace` containing exact steps, rounding rules (`ROUND_HALF_UP_TO_4_DECIMALS`), and final certificates.

## 8. Entitlement & Credit Flow
- **Scaling:** 100 Account Credits = 5 Sealed Reports.
- **Ledger Enforcement:** Managed via `unlockCbamUses` and Firebase triggers logging immutable actions to `creditLedger`. `creditSummary` holds the active balance.

## 9. Artifact Generation Flow
- **Generation:** `manifest-generator.ts` generates JSON Audit Manifests (trace trees) and proprietary XML exports. PDFs are presumably rendered on demand or bundled via ZIP. Outputs are verified by `document_seals`.

## 10. Disconnected & Broken Paths (Immediate Targets)
- **`/cbam/new`:** Functions as a generic global tabbed workspace. No persistent case architecture ID enforcement on load.
- **Missing-as-Zero:** Missing parameters mathematically resolve to 0 in calculations rather than correctly flagging as `NOT_CALCULATED` or `ZERO_DENOMINATOR`.
- **Evidence Linkage:** No tight UI bridging between raw uploaded evidence items and deterministic inputs.
- **Formula Registration:** Trace currently relies on hardcoded string derivations (e.g. `hash_xs7`), rather than real SHA-256 node tracing against the legal-source registry.
- **Dashboard:** Credit explanation is vague (shows `Credits: 0` without commercial conversion clarity). Empty state CTAs are misdirected.
- **Tab UI:** Lacks rigorous sequential Step 1->8 tracking with ruleset-driven blocker counts and completion percentages.
