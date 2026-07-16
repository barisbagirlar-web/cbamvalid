import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREPARATION_PACK as WEB_PACK } from "../../lib/commerce/preparation-pack";
import { PREPARATION_PACK as FUNCTIONS_PACK } from "../../functions/src/commerce/preparation-pack";
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  assertOrderTransition,
  isOrderTransitionAllowed,
} from "../../functions/src/commerce/order-state";

const SANDBOX_PRICE_ID = "pri_01sandboxvalid";
const PRODUCTION_PRICE_ID = "pri_01productionvalid";
const unmarshal = vi.hoisted(() => vi.fn());

vi.mock("../../functions/src/commerce/paddle-client", () => ({
  paddle: { webhooks: { unmarshal } },
  isSandboxMode: () => true,
  assertPaddleConfigured: () => undefined,
}));

function validTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: "txn_valid_123",
    status: "completed",
    currencyCode: "USD",
    customData: {
      uid: "user-123",
      orderId: `ord_${"a".repeat(64)}`,
      productCode: "CBAM_CREDIT_PACK_5",
      caseId: "case-123",
      environment: "sandbox",
    },
    items: [{ quantity: 1, price: { id: SANDBOX_PRICE_ID } }],
    details: { totals: { total: "14900" } },
    ...overrides,
  };
}

describe("Canonical Preparation Pack", () => {
  it("keeps browser and Functions contracts identical", () => {
    expect(FUNCTIONS_PACK).toEqual(WEB_PACK);
    expect(WEB_PACK).toMatchObject({
      productCode: "CBAM_CREDIT_PACK_5",
      slug: "cbam-5-reports",
      currency: "USD",
      priceMinor: 14900,
      accountCredits: 100,
      maxReleases: 5,
      creditsPerRelease: 20,
    });
    expect(WEB_PACK.maxReleases * WEB_PACK.creditsPerRelease).toBe(WEB_PACK.accountCredits);
  });

  it("exposes one active server product and rejects placeholder price IDs", async () => {
    process.env.PADDLE_PRICE_ID_SANDBOX = SANDBOX_PRICE_ID;
    process.env.PADDLE_PRICE_ID_PRODUCTION = PRODUCTION_PRICE_ID;
    vi.resetModules();
    const { PRODUCT_CATALOG, getPriceIdForProduct, getProduct } = await import(
      "../../functions/src/commerce/catalog"
    );
    expect(Object.keys(PRODUCT_CATALOG)).toEqual([WEB_PACK.productCode]);
    expect(getProduct(WEB_PACK.productCode)?.expectedUnitAmount).toBe(14900);
    expect(getPriceIdForProduct(WEB_PACK.productCode, true)).toBe(SANDBOX_PRICE_ID);
    expect(getPriceIdForProduct(WEB_PACK.productCode, false)).toBe(PRODUCTION_PRICE_ID);
    expect(getPriceIdForProduct("INVALID_PRODUCT", true)).toBeNull();
    delete process.env.PADDLE_PRICE_ID_SANDBOX;
    delete process.env.PADDLE_PRICE_ID_PRODUCTION;
  });
});

describe("Paddle Transaction Contract", () => {
  beforeEach(() => {
    process.env.PADDLE_PRICE_ID_SANDBOX = SANDBOX_PRICE_ID;
    process.env.PADDLE_PRICE_ID_PRODUCTION = PRODUCTION_PRICE_ID;
    vi.resetModules();
  });

  it("accepts only the exact catalog amount, price, quantity and environment", async () => {
    const { validateCompletedTransaction } = await import(
      "../../functions/src/commerce/transaction-contract"
    );
    expect(validateCompletedTransaction(validTransaction(), true)).toEqual({
      transactionId: "txn_valid_123",
      uid: "user-123",
      orderId: `ord_${"a".repeat(64)}`,
      caseId: "case-123",
      productCode: "CBAM_CREDIT_PACK_5",
      currency: "USD",
      totalMinor: 14900,
      quantity: 1,
      priceId: SANDBOX_PRICE_ID,
    });
  });

  it.each([
    ["wrong currency", { currencyCode: "EUR" }, "PADDLE_CURRENCY_MISMATCH"],
    ["wrong total", { details: { totals: { total: "14901" } } }, "PADDLE_AMOUNT_MISMATCH"],
    ["wrong price", { items: [{ quantity: 1, price: { id: "pri_01attacker" } }] }, "PADDLE_PRICE_ID_MISMATCH"],
    ["wrong environment", { customData: { uid: "user-123", orderId: `ord_${"a".repeat(64)}`, productCode: "CBAM_CREDIT_PACK_5", caseId: "case-123", environment: "production" } }, "PADDLE_ENVIRONMENT_MISMATCH"],
    ["wrong quantity", { items: [{ quantity: 2, price: { id: SANDBOX_PRICE_ID } }] }, "PADDLE_QUANTITY_INVALID"],
  ])("rejects %s", async (_name, override, errorCode) => {
    const { validateCompletedTransaction } = await import(
      "../../functions/src/commerce/transaction-contract"
    );
    expect(() => validateCompletedTransaction(validTransaction(override), true)).toThrow(errorCode);
  });
});

describe("Order State Kernel", () => {
  it("defines a transition row for every order status", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it("allows only declared transitions plus idempotent same-state writes", () => {
    for (const current of ORDER_STATUSES) {
      for (const target of ORDER_STATUSES) {
        const expected = current === target || ORDER_TRANSITIONS[current].includes(target);
        expect(isOrderTransitionAllowed(current, target)).toBe(expected);
        if (expected) {
          expect(() => assertOrderTransition(current, target)).not.toThrow();
        } else {
          expect(() => assertOrderTransition(current, target)).toThrow(
            `ORDER_STATE_TRANSITION_INVALID:${current}:${target}`
          );
        }
      }
    }
  });

  it("keeps refund states terminal", () => {
    expect(ORDER_TRANSITIONS.REFUNDED_UNUSED).toEqual([]);
    expect(ORDER_TRANSITIONS.REFUNDED_AFTER_DELIVERY).toEqual([]);
  });
});

describe("Webhook Signature Boundary", () => {
  beforeEach(() => {
    unmarshal.mockReset();
    process.env.PADDLE_WEBHOOK_SECRET = "test-secret";
  });

  it("returns the verified Paddle event", async () => {
    const event = { eventId: "evt_1", eventType: "transaction.completed", data: {} };
    unmarshal.mockResolvedValueOnce(event);
    const { verifyWebhookSignature } = await import(
      "../../functions/src/commerce/webhook-verifier"
    );
    await expect(verifyWebhookSignature("{}", "ts=1;h1=valid")).resolves.toEqual(event);
  });

  it("rejects empty and invalid signatures with the canonical security code", async () => {
    const { verifyWebhookSignature } = await import(
      "../../functions/src/commerce/webhook-verifier"
    );
    await expect(verifyWebhookSignature("{}", "")).rejects.toMatchObject({
      code: "INVALID_WEBHOOK_SIGNATURE",
      status: 401,
    });
    unmarshal.mockRejectedValueOnce(new Error("invalid"));
    await expect(verifyWebhookSignature("{}", "bad")).rejects.toMatchObject({
      code: "INVALID_WEBHOOK_SIGNATURE",
      status: 401,
    });
  });
});
