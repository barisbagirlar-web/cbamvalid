import { requireFirebaseSession, AuthError } from "@/lib/auth/require-firebase-session";
import { getCreditPackageBySlug } from "@/lib/billing/catalog";
import { getPaddleConfig } from "@/lib/billing/paddle-config.server";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";
import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";

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

    // 0. IMMEDIATE COMMERCIAL CONTAINMENT: Check publicPaidLaunchEnabled flag
    let publicPaidLaunchEnabled = false;
    try {
      const configDoc = await adminDb.collection("system").doc("config").get();
      if (configDoc.exists) {
        publicPaidLaunchEnabled = configDoc.data()?.publicPaidLaunchEnabled === true;
      }
    } catch (e) {
      console.error("Failed to read system/config:", e);
    }

    const isPrivileged = decoded.role === "admin" || decoded.admin === true || decoded.role === "pilot" || decoded.pilot === true || decoded.role === "Owner";
    if (!publicPaidLaunchEnabled && !isPrivileged) {
      return apiFailure("PAYMENT_DISABLED", "Purchasing is temporarily unavailable while final launch checks are completed.", 403);
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

    const slug = payload.slug || "pack_premium_dossier_v5";
    const caseId = payload.caseId || "";

    // 4. Resolve package from server catalog
    const packageDef = getCreditPackageBySlug(slug);
    if (!packageDef || !packageDef.active) {
      return apiFailure("INVALID_PACKAGE", "Selected credit package is invalid or inactive.", 400);
    }

    const canonicalProductCode = "pack_premium_dossier_v5";
    const orderId = `ord_${crypto.randomBytes(12).toString("hex")}`;
    const now = new Date().toISOString();

    // Create server-side immutable commerce order
    const orderRef = adminDb.collection("commerce_orders").doc(orderId);
    const orderData = {
      orderId,
      uid: decoded.uid,
      caseId: caseId,
      productCode: canonicalProductCode,
      canonicalProductCode: canonicalProductCode,
      paddlePriceId: packageDef.paddlePriceId,
      currency: "USD",
      amountMinor: 14900,
      status: "CHECKOUT_CREATED",
      createdAt: now,
      updatedAt: now,
      catalogVersion: "v5",
    };

    await orderRef.set(orderData);

    const transactionUrl = paddleConfig.isSandbox
      ? "https://sandbox-api.paddle.com/transactions"
      : "https://api.paddle.com/transactions";

    // 5. Create Paddle transaction with OPAQUE customData (orderId and correlationId only)
    const correlationId = crypto.randomUUID();
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
          orderId: orderId,
          correlationId: correlationId,
        }
      })
    });

    if (!paddleRes.ok) {
      const errorText = await paddleRes.text();
      console.error("[PADDLE API TRANSACTION FAILURE]:", paddleRes.status, errorText);
      await orderRef.update({ status: "PAYMENT_FAILED", updatedAt: new Date().toISOString() });
      if (paddleRes.status === 403) {
        return apiFailure(
          "PADDLE_TRANSACTION_CREATE_FAILED",
          "Paddle API key is not authorized to create transactions. Verify key permissions in Paddle Dashboard.",
          403
        );
      }
      return apiFailure("PADDLE_TRANSACTION_CREATE_FAILED", "Checkout could not be started.", 500);
    }

    const responseData = await paddleRes.json();
    const transactionId = responseData.data.id;

    // Update order status and transaction ID
    await orderRef.update({
      paddleTransactionId: transactionId,
      status: "PAYMENT_PENDING",
      updatedAt: new Date().toISOString(),
    });

    return apiSuccess({ transactionId });

  } catch (err: any) {
    console.error("[PADDLE CHECKOUT UNEXPECTED SERVER ERROR]:", err.message || err);
    return apiFailure("INTERNAL_SERVER_ERROR", "Checkout could not be started.", 500);
  }
}
