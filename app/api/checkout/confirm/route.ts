import { requireFirebaseSession, AuthError } from "@/lib/auth/require-firebase-session";
import { fulfillCheckoutOrder } from "@/lib/billing/fulfill-checkout-order";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let decoded;
    try {
      decoded = await requireFirebaseSession(request);
    } catch (authError: unknown) {
      if (authError instanceof AuthError) {
        return apiFailure(authError.code, authError.message, authError.status);
      }
      return apiFailure("UNAUTHORIZED", "Session expired or authentication failed.", 401);
    }

    let payload: { orderId?: string; transactionId?: string };
    try {
      payload = await request.json();
    } catch {
      return apiFailure("BAD_REQUEST", "Malformed JSON request payload.", 400);
    }

    const orderId = String(payload.orderId || "").trim();
    const transactionId = String(payload.transactionId || "").trim();
    if (!orderId || !transactionId) {
      return apiFailure("BAD_REQUEST", "orderId and transactionId are required.", 400);
    }
    if (!/^ord_[a-zA-Z0-9]+$/.test(orderId)) {
      return apiFailure("BAD_REQUEST", "Invalid orderId.", 400);
    }
    if (!/^txn_[a-zA-Z0-9]+$/.test(transactionId)) {
      return apiFailure("BAD_REQUEST", "Invalid transactionId.", 400);
    }

    try {
      const result = await fulfillCheckoutOrder({
        uid: decoded.uid,
        orderId,
        transactionId,
      });
      return apiSuccess(result);
    } catch (fulfillError: unknown) {
      const message = fulfillError instanceof Error ? fulfillError.message : "FULFILLMENT_FAILED";
      console.error("[CHECKOUT CONFIRM FAILED]:", message);
      if (
        message === "ORDER_NOT_FOUND" ||
        message === "ORDER_OWNERSHIP_MISMATCH" ||
        message.startsWith("ORDER_ID_MISMATCH") ||
        message.startsWith("PRICE_ID_MISMATCH") ||
        message.startsWith("AMOUNT_MISMATCH") ||
        message.startsWith("CURRENCY_MISMATCH") ||
        message.startsWith("QUANTITY_MISMATCH") ||
        message === "TRANSACTION_HAS_NO_ITEMS" ||
        message === "CASE_ID_REQUIRED_FOR_FULFILLMENT"
      ) {
        return apiFailure("FULFILLMENT_REJECTED", "Payment could not be verified for this order.", 403);
      }
      if (message.startsWith("TRANSACTION_NOT_PAID")) {
        return apiFailure("PAYMENT_PENDING", "Payment is not completed yet.", 409);
      }
      if (message.startsWith("PADDLE_TRANSACTION_FETCH_FAILED")) {
        return apiFailure("PADDLE_LOOKUP_FAILED", "Could not verify payment with Paddle.", 502);
      }
      return apiFailure("FULFILLMENT_FAILED", "Payment confirmation failed.", 500);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[CHECKOUT CONFIRM UNEXPECTED]:", message);
    return apiFailure("INTERNAL_SERVER_ERROR", "Payment confirmation failed.", 500);
  }
}
