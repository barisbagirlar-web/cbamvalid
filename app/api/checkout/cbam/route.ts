import { requireFirebaseSession, AuthError } from "@/lib/auth/require-firebase-session";
import { getCreditPackageBySlug } from "@/lib/billing/catalog";
import { getPaddleConfig } from "@/lib/billing/paddle-config.server";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Validate session authentication first
    let decoded;
    try {
      decoded = await requireFirebaseSession();
    } catch (authError: any) {
      if (authError instanceof AuthError) {
        return apiFailure(authError.code, authError.message, authError.status);
      }
      console.error("[PADDLE CHECKOUT AUTH ERROR]:", authError.message || authError);
      return apiFailure("UNAUTHORIZED", "Session expired or authentication failed.", 401);
    }

    // 2. Validate Paddle runtime config
    let paddleConfig;
    try {
      paddleConfig = getPaddleConfig();
    } catch (configError: any) {
      console.error("[PADDLE CHECKOUT CONFIG ERROR]:", configError.message || configError);
      return apiFailure("PADDLE_CONFIGURATION_ERROR", "Payment system configuration is invalid.", 500);
    }

    // 3. Validate request JSON payload
    let payload;
    try {
      payload = await request.json();
    } catch (jsonError) {
      return apiFailure("BAD_REQUEST", "Malformed JSON request payload.", 400);
    }

    const slug = payload.slug;
    if (!slug) {
      return apiFailure("INVALID_PACKAGE", "Missing package selection identifier.", 400);
    }

    // 4. Resolve package from server catalog
    const packageDef = getCreditPackageBySlug(slug);
    if (!packageDef || !packageDef.active) {
      return apiFailure("INVALID_PACKAGE", "Selected credit package is invalid or inactive.", 400);
    }

    const productCode = slug === "cbam-5-reports" ? "CBAM_CREDIT_PACK_5" : "CBAM_EXPORTER_FINAL_REPORT";
    const transactionUrl = paddleConfig.isSandbox
      ? "https://sandbox-api.paddle.com/transactions"
      : "https://api.paddle.com/transactions";

    // 5. Create Paddle transaction
    const paddleRes = await fetch(transactionUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paddleConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            price_id: packageDef.paddlePriceId,
            quantity: 1,
          }
        ],
        custom_data: {
          uid: decoded.uid,
          productCode: productCode,
          orderId: `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        }
      })
    });

    if (!paddleRes.ok) {
      const errorText = await paddleRes.text();
      console.error("[PADDLE API TRANSACTION FAILURE]:", paddleRes.status, errorText);
      if (paddleRes.status === 403) {
        return apiFailure(
          "PADDLE_TRANSACTION_CREATE_FAILED",
          "Paddle API key is not authorized to create transactions. Verify key permissions in Paddle Dashboard.",
          403
        );
      }
      return apiFailure("PADDLE_TRANSACTION_CREATE_FAILED", "Checkout could not be started.", 500);
    }

    const data = await paddleRes.json();
    return apiSuccess({ transactionId: data.data.id });

  } catch (err: any) {
    console.error("[PADDLE CHECKOUT UNEXPECTED SERVER ERROR]:", err.message || err);
    return apiFailure("INTERNAL_SERVER_ERROR", "Checkout could not be started.", 500);
  }
}
