# Paddle sandbox-to-live release runbook

## Decision

Paddle live-account or domain approval does not block application development, Firebase sandbox deployment, report generation, or end-to-end test payments. It blocks real-money live checkout only.

Keep the public paid launch switch closed until the live checklist is complete:

```text
Firestore: system/config.publicPaidLaunchEnabled = false
```

Admins and pilot users may exercise the payment flow while the public switch remains closed.

## Environment separation

| Surface | Sandbox | Live |
|---|---|---|
| Firebase project | `cbam-desk-sandbox` | `cbam-desk` |
| Paddle API base | `https://sandbox-api.paddle.com` | `https://api.paddle.com` |
| API key prefix | `pdl_sdbx_` | `pdl_live_` |
| Client token prefix | `test_` | `live_` |
| Product/price IDs | Sandbox catalog IDs | Separate live catalog IDs |
| Webhook destination | Sandbox Cloud Function | Production Cloud Function |
| Money | Test cards only | Real payment methods after approval |

Never copy Paddle entity IDs or credentials between environments.

## Sandbox definitions

Create a separate Paddle sandbox account and define one one-time product matching the canonical commercial contract:

```text
Product: Exporter Verification Preparation Pack
Price: USD 449.00, one-time
Internal product code: pack_premium_dossier_v5
```

Create:

1. A sandbox API key with transaction read/write and notification-setting read/write permissions.
2. A sandbox client-side token.
3. A sandbox price and record its `pri_...` ID.
4. A notification destination for:
   - `transaction.completed`
   - `transaction.payment_failed`
   - `adjustment.created`
   - `adjustment.updated`

Set the sandbox runtime variables in the sandbox deployment only:

```env
PADDLE_ENV=sandbox
NEXT_PUBLIC_PADDLE_ENV=sandbox
NEXT_PUBLIC_PADDLE_SANDBOX=true
PADDLE_API_KEY=pdl_sdbx_...
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_...
NEXT_PUBLIC_PADDLE_PRICE_ID=pri_...
PADDLE_WEBHOOK_SECRET=...
FIREBASE_PROJECT=cbam-desk-sandbox
FUNCTIONS_REGION=europe-west1
```

Validate without printing secret values:

```bash
npm run check:paddle-config -- --require-webhook
```

Configure/synchronize the sandbox webhook after the sandbox Firebase project and `paddleWebhook` function exist:

```bash
FIREBASE_PROJECT=cbam-desk-sandbox \
PADDLE_API_KEY='pdl_sdbx_...' \
npx tsx scripts/configure-paddle-cbam-webhook.ts
```

## Sandbox acceptance flow

The following must pass before preparing live credentials:

1. Create a new working file as a pilot user.
2. Open the USD 449 sandbox checkout.
3. Complete payment with a Paddle sandbox test card.
4. Receive and verify `transaction.completed`.
5. Create exactly one order, one entitlement, and one economic ledger effect.
6. Lock the paid working file.
7. Correct and re-lock the same working file without a second charge.
8. Confirm a new working file requires a new payment.
9. Confirm duplicate webhook delivery creates no duplicate entitlement or ledger effect.
10. Test payment failure and refund/adjustment behavior.

## Live preparation while approval is pending

The application may be fully prepared, but do not set live credentials in the sandbox project and do not open public checkout.

Prepare the following in the live Paddle account when available:

1. Complete account, identity, and business verification.
2. Submit `cbamvalid.com` for checkout-domain approval.
3. Recreate the one-time product and USD 449 price in the live catalog.
4. Create a live API key and live client-side token.
5. Create the live webhook destination pointing to the production function.
6. Store live credentials only in production Secret Manager/runtime configuration.
7. Run the live configuration check with the public launch switch still closed.
8. Perform an owner-only low-risk live smoke payment and refund.
9. Reconcile the order, transaction, entitlement, ledger, email, and refund.
10. Set `system/config.publicPaidLaunchEnabled=true` only after all checks pass.

Production variables:

```env
PADDLE_ENV=production
NEXT_PUBLIC_PADDLE_ENV=production
NEXT_PUBLIC_PADDLE_SANDBOX=false
PADDLE_API_KEY=pdl_live_...
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_...
NEXT_PUBLIC_PADDLE_PRICE_ID=pri_...
PADDLE_WEBHOOK_SECRET=...
FIREBASE_PROJECT=cbam-desk
FUNCTIONS_REGION=europe-west1
```

Configure the live webhook only after live credentials are issued:

```bash
FIREBASE_PROJECT=cbam-desk \
PADDLE_API_KEY='pdl_live_...' \
npx tsx scripts/configure-paddle-cbam-webhook.ts
```

## Go-live stop conditions

Do not enable public paid launch if any item below is unresolved:

- Paddle live account is not active.
- `cbamvalid.com` is not an approved checkout domain.
- Product or price is missing or does not equal USD 449.00.
- API key, client token, price, and webhook secret are from mixed environments.
- Webhook signature verification is unproven.
- Duplicate webhook idempotency is unproven.
- Payment confirmation can create duplicate entitlement or ledger effects.
- Paid lock or same-file correction/re-lock is unproven.
- Refund handling and entitlement state are unreconciled.
- `system/config.publicPaidLaunchEnabled` is already true before acceptance.
