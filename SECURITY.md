# CBAMValid Security Policy

## Reporting a vulnerability

Do not disclose suspected vulnerabilities, credentials, customer records, dossier contents, transaction identifiers or access tokens in a public GitHub issue.

Report security concerns privately to `info@cbamvalid.com` with:

- affected route, component or workflow;
- reproducible steps;
- expected and observed behavior;
- impact assessment;
- relevant timestamps and non-sensitive correlation identifiers.

Do not include real customer evidence, Firebase service-account material, Paddle secrets, session cookies or raw personal data.

## Response priorities

CBAMValid treats the following as release-blocking:

- authentication or tenant-isolation bypass;
- unauthorized dossier, evidence, report or storage access;
- exposed secrets or private keys;
- payment, ledger, credit or entitlement duplication;
- seal-use consumption on failed or blocked releases;
- report-package tampering or manifest hash mismatch;
- production calculation integrity failure.

## Supported version

Security fixes apply to the currently deployed production release and the active release branch. Historical sealed dossiers remain immutable; corrections create a new version rather than modifying an existing sealed release.
