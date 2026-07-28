# Owner — Legal Identity Intake (T1.3)

**Status:** CODE READY · VALUES = OWNER ACTION  
**Publish path:** env vars → `lib/legal-identity.ts` → footer / legal-notice / `/trust`  
**Rule (H2):** Never invent CRO, VAT, street address, or phone.

## Paste these into Firebase / hosting secrets (or `.env.local` for local)

```bash
LEGAL_CRO=          # Irish Companies Registration Office number
LEGAL_VAT=          # VAT / tax ID (e.g. IE…)
LEGAL_REGISTERED_ADDRESS=   # Full registered office street line
LEGAL_SUPPORT_PHONE=        # Public support phone with country code
LEGAL_DPO=                  # Data protection contact name or mailbox
# optional:
LEGAL_COUNTRY=Ireland
```

Then redeploy. When all five required fields are non-empty, the site automatically switches from **minimal** identity to the **full T1.3** block.

## Also close commercial proof

1. **Paddle live** catalog price for the checkout price ID = **USD 449.00** (sandbox already proven = 44900).
2. Run: `npm run prove:paddle-amount`
3. Send outreach emails in `docs/outreach/verifier-structure-review-outreach.md`
4. When a signed structure letter arrives → place PDF under `public/verifier-review/` and update `lib/trust/verifier-structure-review.ts` + evidence registry status

## Check public registry

https://cbamvalid.com/trust
