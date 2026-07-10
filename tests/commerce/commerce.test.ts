import { describe, it, expect, vi } from "vitest";
import { PRODUCT_CATALOG, getPriceIdForProduct } from "../../lib/commerce/catalog";
import { verifyWebhookSignature } from "../../lib/commerce/webhook-verifier";
import { InvalidWebhookSignatureError } from "../../lib/commerce/commerce-errors";

vi.mock("../../lib/commerce/paddle-client", () => {
  return {
    paddle: {
      webhooks: {
        unmarshal: vi.fn(),
      },
    },
    isSandboxMode: () => true,
  };
});

import { paddle } from "../../lib/commerce/paddle-client";

describe("Catalog & Pricing Mappings", () => {
  it("Resolves sandbox and production price IDs correctly", () => {
    const sandboxPrice = getPriceIdForProduct("CBAM_EXPORTER_FINAL_REPORT", true);
    const prodPrice = getPriceIdForProduct("CBAM_EXPORTER_FINAL_REPORT", false);
    
    expect(sandboxPrice).not.toBeNull();
    expect(prodPrice).not.toBeNull();
  });

  it("Rejects unknown product code lookup with null", () => {
    const unknown = getPriceIdForProduct("INVALID_PRODUCT_CODE", true);
    expect(unknown).toBeNull();
  });
});

describe("Webhook Verification Rules", () => {
  it("unmarshal validation throws InvalidWebhookSignatureError on signature check failure", async () => {
    process.env.PADDLE_WEBHOOK_SECRET_KEY = "test-secret";
    vi.mocked(paddle.webhooks.unmarshal).mockRejectedValue(new Error("Signature verification failed"));

    await expect(verifyWebhookSignature("{}", "bad-sig")).rejects.toThrow(InvalidWebhookSignatureError);
  });
});
