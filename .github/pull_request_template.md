## Purpose

Describe the user or operational problem this change solves.

## Scope

- [ ] Frontend
- [ ] Backend / API
- [ ] Authentication / authorization
- [ ] Firebase / Firestore / Storage
- [ ] Paddle / credits / entitlement
- [ ] CBAM calculation engine
- [ ] Evidence / reports / sealing
- [ ] CI / security / release controls

## Risk assessment

- Failure modes considered:
- Data migration or compatibility risk:
- Rollback path:
- Irreversible external action required: Yes / No

## Verification evidence

Provide actual commands, exit codes and artifacts. Do not write `PASS` without evidence.

```text
TYPECHECK=
LINT=
UNIT_TESTS=
INTEGRATION_TESTS=
BUILD=
NAVIGATION_CONTRACT=
SECURITY_GATES=
BROWSER_E2E=
```

## Release-critical checks

- [ ] No secret, private key, `.env` file or customer data is committed
- [ ] Tenant isolation and server-side authorization were reviewed where applicable
- [ ] Calculation expected values are independent of the production function under test
- [ ] Failed or blocked sealing consumes zero uses
- [ ] Duplicate webhook or request replay produces zero additional credit/use delta
- [ ] Public and authenticated headers remain mutually exclusive
- [ ] Dashboard, Cases, Reports and Methodology routes show distinct intended content
- [ ] User-visible claims do not imply accredited verification, customs approval or guaranteed acceptance
- [ ] Deployment is not included unless explicitly approved

## Changed surfaces

List the callers, imports, APIs, schemas, storage paths, reports, tests and guards affected by this change.

## Known blockers

Use only: `NONE`, `NOT_PROVEN`, `NOT_IMPLEMENTED`, `FAIL`, or `EXTERNAL_BLOCKER`.
