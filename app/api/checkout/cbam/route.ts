import { adminAuth } from "@/lib/firebase/admin";
import { getCreditPackageBySlug } from "@/lib/billing/catalog";
import { getPaddleConfig } from "@/lib/billing/paddle-config.server";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Validate Paddle runtime config
    let paddleConfig;
    try {
      paddleConfig = getPaddleConfig();
    } catch (configError: any) {
      console.error("[PADDLE CHECKOUT CONFIG ERROR]:", configError.message || configError);
      return apiFailure("PADDLE_CONFIGURATION_ERROR", "Payment system configuration is invalid.", 500);
    }

    // 2. Validate session authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return apiFailure("UNAUTHORIZED", "Missing or invalid session authorization.", 401);
    }
    const token = authHeader.split("Bearer ")[1];
    
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch (authError: any) {
      console.error("[PADDLE CHECKOUT AUTH ERROR]:", authError.message || authError);
      return apiFailure("UNAUTHORIZED", "Session expired or authentication failed.", 401);
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
      return apiFailure("PADDLE_TRANSACTION_CREATE_FAILED", "Checkout could not be started.", 500);
    }

    const data = await paddleRes.json();
    return apiSuccess({ transactionId: data.data.id });

  } catch (err: any) {
    console.error("[PADDLE CHECKOUT UNEXPECTED SERVER ERROR]:", err.message || err);
    return apiFailure("INTERNAL_SERVER_ERROR", "Checkout could not be started.", 500);
  }
}
