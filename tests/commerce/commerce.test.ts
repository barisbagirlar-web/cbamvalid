import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidWebhookSignatureError } from "../../functions/src/commerce/commerce-errors";

vi.mock("../../functions/src/commerce/paddle-client", () => {
  return {
    paddle: {
      webhooks: {
        unmarshal: vi.fn(),
      },
    },
    isSandboxMode: () => true,
  };
});

import { paddle } from "../../functions/src/commerce/paddle-client";
import { verifyWebhookSignature } from "../../functions/src/commerce/webhook-verifier";

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  delete process.env.PADDLE_PRICE_ID_SANDBOX;
  delete process.env.PADDLE_PRICE_ID_PRODUCTION;
  delete process.env.PADDLE_WEBHOOK_SECRET;
});

describe("Catalog & Pricing Mappings", () => {
  it("resolves the single Preparation Pack product to environment-specific price IDs", async () => {
    process.env.PADDLE_PRICE_ID_SANDBOX = "pri_test_pack_sandbox";
    process.env.PADDLE_PRICE_ID_PRODUCTION = "pri_test_pack_production";

    const { getPriceIdForProduct, PREPARATION_PACK_PRODUCT_CODE } = await import(
      "../../functions/src/commerce/catalog"
    );

    expect(getPriceIdForProduct(PREPARATION_PACK_PRODUCT_CODE, true)).toBe("pri_test_pack_sandbox");
    expect(getPriceIdForProduct(PREPARATION_PACK_PRODUCT_CODE, false)).toBe("pri_test_pack_production");
  });

  it("rejects unknown and retired product codes", async () => {
    const { getPriceIdForProduct } = await import("../../functions/src/commerce/catalog");

    expect(getPriceIdForProduct("INVALID_PRODUCT_CODE", true)).toBeNull();
    expect(getPriceIdForProduct("CBAM_EXPORTER_FINAL_REPORT", true)).toBeNull();
  });
});

describe("Webhook Verification Rules", () => {
  it("fails closed when the canonical webhook secret is missing", async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;

    await expect(verifyWebhookSignature("{}", "bad-sig")).rejects.toThrow(
      "PADDLE_WEBHOOK_SECRET missing."
    );
    expect(paddle.webhooks.unmarshal).not.toHaveBeenCalled();
  });

  it("normalizes Paddle signature rejection to InvalidWebhookSignatureError", async () => {
    process.env.PADDLE_WEBHOOK_SECRET = "test-secret";
    vi.mocked(paddle.webhooks.unmarshal).mockRejectedValue(new Error("Signature verification failed"));

    await expect(verifyWebhookSignature("{}", "bad-sig")).rejects.toThrow(InvalidWebhookSignatureError);
    expect(paddle.webhooks.unmarshal).toHaveBeenCalledWith("{}", "test-secret", "bad-sig");
  });
});
