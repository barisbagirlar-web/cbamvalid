import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPriceIdForProduct,
  getProductDefinition,
} from "../../functions/src/commerce/catalog";
import { InvalidWebhookSignatureError } from "../../functions/src/commerce/commerce-errors";
import { verifyWebhookSignature } from "../../functions/src/commerce/webhook-verifier";

const { unmarshal } = vi.hoisted(() => ({ unmarshal: vi.fn() }));

vi.mock("../../functions/src/commerce/paddle-client", () => ({
  getPaddleClient: () => ({ webhooks: { unmarshal } }),
  isSandboxMode: () => true,
}));

describe("canonical catalog and Paddle verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PADDLE_PRICE_ID_SANDBOX = "pri_sandbox123";
    process.env.PADDLE_PRICE_ID_PRODUCTION = "pri_production123";
    process.env.PADDLE_WEBHOOK_SECRET = "webhook-secret";
  });

  it("resolves environment-specific price IDs from server configuration", () => {
    expect(getPriceIdForProduct("CBAM_EXPORTER_FINAL_REPORT", true)).toBe("pri_sandbox123");
    expect(getPriceIdForProduct("CBAM_EXPORTER_FINAL_REPORT", false)).toBe("pri_production123");
    expect(getProductDefinition("CBAM_CREDIT_PACK_5").productCode).toBe("CBAM_EXPORTER_FINAL_REPORT");
  });

  it("rejects unknown product codes and missing price configuration", () => {
    expect(() => getProductDefinition("INVALID_PRODUCT_CODE")).toThrow("COMMERCIAL_PRODUCT_CODE_INVALID");
    delete process.env.PADDLE_PRICE_ID_SANDBOX;
    expect(() => getPriceIdForProduct("CBAM_EXPORTER_FINAL_REPORT", true)).toThrow("PADDLE_SANDBOX_PRICE_ID_MISSING");
  });

  it("returns a typed verified webhook event", async () => {
    unmarshal.mockResolvedValueOnce({
      eventId: "evt_123",
      eventType: "transaction.completed",
      occurredAt: "2026-07-15T00:00:00.000Z",
      data: { id: "txn_123" },
    });

    await expect(verifyWebhookSignature("{\"id\":1}", "ts=1;h1=signature")).resolves.toEqual({
      eventId: "evt_123",
      eventType: "transaction.completed",
      occurredAt: "2026-07-15T00:00:00.000Z",
      data: { id: "txn_123" },
    });
  });

  it("fails closed for invalid signatures, missing secrets and malformed events", async () => {
    unmarshal.mockRejectedValueOnce(new Error("Signature verification failed"));
    await expect(verifyWebhookSignature("{}", "bad-sig")).rejects.toThrow(InvalidWebhookSignatureError);

    delete process.env.PADDLE_WEBHOOK_SECRET;
    await expect(verifyWebhookSignature("{}", "bad-sig")).rejects.toThrow("PADDLE_WEBHOOK_SECRET_MISSING");

    process.env.PADDLE_WEBHOOK_SECRET = "webhook-secret";
    unmarshal.mockResolvedValueOnce({ eventId: "", eventType: "", occurredAt: "", data: null });
    await expect(verifyWebhookSignature("{}", "ts=1;h1=signature")).rejects.toThrow(InvalidWebhookSignatureError);
  });
});
