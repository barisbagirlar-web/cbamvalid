# Paddle Domain Appeal — cbamvalid.com

## Non-negotiable release gate

Do not send the appeal until the exact remediation commit is deployed to `https://cbamvalid.com` and every check below passes against the live domain.

### Source and deployment equality

```text
MAIN_SHA = DEPLOYED_SHA = LIVE_APP_SHA
```

### Required live pages

All must return HTTP 200 over HTTPS:

- `https://cbamvalid.com/`
- `https://cbamvalid.com/product`
- `https://cbamvalid.com/pricing`
- `https://cbamvalid.com/product-classification`
- `https://cbamvalid.com/terms`
- `https://cbamvalid.com/refund-policy`
- `https://cbamvalid.com/privacy`
- `https://cbamvalid.com/legal-notice`
- `https://cbamvalid.com/contact`
- `https://cbamvalid.com/demo`
- `https://cbamvalid.com/sample-dossier`

### Removed service routes

All must return HTTP 404 or 410 and must not redirect to a sales page:

- `https://cbamvalid.com/enterprise`
- `https://cbamvalid.com/partners`
- `https://cbamvalid.com/verifier-review`

### Required live classification evidence

- Homepage title: `CBAMValid — Self-Service Emissions Data Software`
- Homepage H1: `Emissions Data Workspace and Document Generator`
- Product type: privately operated self-service B2B software
- Commercial unit: one Working File Software Unlock
- Website price: USD 449 one-time
- Paddle catalog price: USD 449 one-time
- Delivery: automated PDF, JSON and XLSX files
- Customer controls and enters the data
- Detailed excluded services appear only in Terms and Product Classification
- Seller identity is identical across Terms, Privacy, Refund, Legal Notice, Contact and footer
- No placeholder address or template company data

### Forbidden live commercial phrases

Count must be zero on primary commercial surfaces and public logo assets:

- `Carbon Border Compliance Validation`
- `Exporter Verification Preparation Pack`
- `Prepared for Independent Accredited Verification`
- `CBAM Exporter Final Evidence Report`
- `Structure Review`
- `Enterprise Exclusive`
- `Talk to an Expert`
- `Book a Consultation`

### Paddle catalog parity

Run with production Paddle credentials:

```bash
npm run check:paddle-config -- --require-production --require-webhook --verify-catalog
```

Required result:

```text
PADDLE_CREDENTIAL_PARITY=PASS
PADDLE_SINGLE_PRODUCT_CONTRACT=PASS
PADDLE_CATALOG_PRICE_PARITY=PASS
PADDLE_LAUNCH_MODE=LIVE_CREDENTIALS_CONFIGURED
```

## Appeal subject

Appeal: cbamvalid.com is self-service B2B software with automated digital delivery

## Ready-to-send appeal

Hello Paddle Domain Review Team,

I am appealing the rejection of `cbamvalid.com` under `Other/Government Services` because the commercial product is privately operated self-service B2B software.

Customers enter and control their own business and emissions data. The application performs deterministic calculations, automated quality controls, customer-controlled evidence linking, and automated PDF, JSON and XLSX generation.

The product is a one-time USD 449 software unlock for one customer-controlled working file covering one operator, one installation and one reporting year. Drafting is free. After a successful lock, the application automatically generates downloadable digital files. Same-file correction re-locks and re-downloads are included.

The purchase is limited to software access and automated digital delivery. Detailed commercial boundaries are published in our Terms and Product Classification Statement. Customers remain responsible for their own data, external submissions, professional advice and any independent third-party review required for their workflow.

Regulatory references appear because the software implements published calculation rules and records the ruleset used. Those references are calculation and documentation inputs within the software product.

The public website now presents the product consistently as self-service B2B software:

- `https://cbamvalid.com/`
- `https://cbamvalid.com/product`
- `https://cbamvalid.com/pricing`
- `https://cbamvalid.com/product-classification`
- `https://cbamvalid.com/terms`
- `https://cbamvalid.com/refund-policy`
- `https://cbamvalid.com/privacy`

A self-guided software demonstration and sample automated digital outputs are available at:

- `https://cbamvalid.com/demo`
- `https://cbamvalid.com/sample-dossier`

Please manually re-review `cbamvalid.com` as B2B SaaS / self-service software with automated digital delivery. We can provide a non-admin test account, company registration evidence, product ownership evidence and additional processing information if required.

Kind regards,
Baris Bagirlar
SectorCalc Corporation / CBAMValid
info@cbamvalid.com

## Evidence package for submission

Attach or link only evidence captured after the remediation SHA is deployed:

1. Homepage screenshot showing `B2B SaaS · Automated digital delivery` and the software H1.
2. Product screenshot showing customer-controlled data entry and automated functions.
3. Pricing screenshot showing USD 449 one-time and automated PDF/JSON/XLSX delivery.
4. Product Classification screenshot showing included software functions and detailed boundaries.
5. Terms screenshot showing the paid scope is software access and automated digital delivery.
6. Privacy, Refund, Legal Notice and Contact screenshots showing one identical legal identity.
7. Two-minute self-guided workflow video: register → create draft → enter data → automated checks → lock screen → generated files.
8. Sample generated PDF, JSON and XLSX outputs.
9. Non-admin test-account credentials supplied privately to Paddle when requested.
10. Official company registration and VAT evidence matching the public seller identity.
11. Terminal evidence for `PADDLE_CATALOG_PRICE_PARITY=PASS`.
12. Deployment evidence proving `MAIN_SHA = DEPLOYED_SHA = LIVE_APP_SHA`.

## Accurate classification sentence

> CBAMValid is privately operated self-service B2B software for customer-entered emissions data, deterministic calculations, automated quality controls and automated PDF, JSON and XLSX delivery.

## Stop conditions

Do not appeal if any of the following is true:

- the remediation commit is not live;
- website and Paddle catalog prices differ;
- a required legal page is unavailable;
- public company identity is inconsistent or unverified;
- a removed service route is still reachable;
- an obsolete commercial phrase is still present on a primary surface or logo asset;
- the product cannot be reviewed with a non-admin test account;
- the demo or sample output is unavailable.
