import crypto from "crypto";
import { requireFirebaseSession, AuthError } from "@/lib/auth/require-firebase-session";
import { getCreditPackageBySlug } from "@/lib/billing/catalog";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { getPaddleConfig } from "@/lib/billing/paddle-config.server";
import { apiSuccess, apiFailure } from "@/lib/http/api-response";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutSuccess = {
  mode: "transaction" | "items";
  orderId: string;
  correlationId: string;
  priceId: string;
  transactionId?: string;
};

export async function POST(request: Request) {
  try {
    let decoded;
    try {
      decoded = await requireFirebaseSession(request);
    } catch (authError: unknown) {
      if (authError instanceof AuthError) {
        return apiFailure(authError.code, authError.message, authError.status);
      }
      console.error("[PADDLE CHECKOUT AUTH ERROR]:", authError);
      return apiFailure("UNAUTHORIZED", "Session expired or authentication failed.", 401);
    }

    let publicPaidLaunchEnabled = false;
    try {
      const configDoc = await adminDb.collection("system").doc("config").get();
      if (configDoc.exists) {
        publicPaidLaunchEnabled = configDoc.data()?.publicPaidLaunchEnabled === true;
      }
    } catch (e) {
      console.error("Failed to read system/config:", e);
    }

    const isPrivileged =
      decoded.role === "admin" ||
      decoded.admin === true ||
      decoded.role === "pilot" ||
      decoded.pilot === true ||
      decoded.role === "Owner";
    if (!publicPaidLaunchEnabled && !isPrivileged) {
      return apiFailure(
        "PAYMENT_DISABLED",
        "Purchasing is temporarily unavailable while final launch checks are completed.",
        403
      );
    }

    let paddleConfig;
    try {
      paddleConfig = getPaddleConfig();
    } catch (configError: unknown) {
      const message = configError instanceof Error ? configError.message : String(configError);
      console.error("[PADDLE CHECKOUT CONFIG ERROR]:", message);
      return apiFailure("PADDLE_CONFIGURATION_ERROR", "Payment system configuration is invalid.", 500);
    }

    let payload: { slug?: string; caseId?: string };
    try {
      payload = await request.json();
    } catch {
      return apiFailure("BAD_REQUEST", "Malformed JSON request payload.", 400);
    }

    const slug = payload.slug || "pack_premium_dossier_v5";
    const caseId = String(payload.caseId || "").trim();
    if (!/^case_[A-Za-z0-9_-]{1,123}$/.test(caseId)) {
      return apiFailure(
        "CASE_ID_REQUIRED",
        "Open a working file and pay when you lock that file. Checkout requires a valid caseId.",
        400
      );
    }

    const caseSnap = await adminDb.collection("cbam_cases").doc(caseId).get();
    if (!caseSnap.exists) {
      return apiFailure("CASE_NOT_FOUND", "Working file not found for checkout.", 404);
    }
    const caseDoc = caseSnap.data() as Record<string, unknown>;
    const caseUid = String(caseDoc.uid || caseDoc.ownerId || "");
    if (!caseUid || caseUid !== decoded.uid) {
      return apiFailure("CASE_OWNERSHIP_MISMATCH", "You do not own this working file.", 403);
    }
    const commercial = (caseDoc.commercial || {}) as Record<string, unknown>;
    if (String(commercial.status || "").toUpperCase() === "PAID") {
      return apiFailure(
        "CASE_ALREADY_PAID",
        "This working file is already paid. Return to the file and lock it — do not pay again.",
        409
      );
    }

    // Prefer an existing case-scoped entitlement (already paid via confirm/webhook).
    const existingEnt = await adminDb
      .collection("entitlements")
      .where("uid", "==", decoded.uid)
      .where("scopeCaseId", "==", caseId)
      .where("status", "==", "AVAILABLE")
      .limit(1)
      .get();
    if (!existingEnt.empty) {
      return apiFailure(
        "CASE_ALREADY_PAID",
        "This working file is already paid. Return to the file and lock it — do not pay again.",
        409
      );
    }

    const packageDef = getCreditPackageBySlug(slug);
    if (!packageDef || !packageDef.active) {
      return apiFailure("INVALID_PACKAGE", "Selected credit package is invalid or inactive.", 400);
    }

    const priceId =
      (packageDef.paddlePriceId && packageDef.paddlePriceId !== "missing-price-id"
        ? packageDef.paddlePriceId
        : paddleConfig.priceId) || "";
    if (!priceId || priceId === "missing-price-id") {
      return apiFailure("PADDLE_CONFIGURATION_ERROR", "Paddle price ID is not configured.", 500);
    }

    const canonicalProductCode = "pack_premium_dossier_v5";
    const orderId = `ord_${crypto.randomBytes(12).toString("hex")}`;
    const correlationId = crypto.randomUUID();
    const now = new Date().toISOString();

    const orderRef = adminDb.collection("commerce_orders").doc(orderId);
    await adminDb.runTransaction(async (transaction) => {
      const freshCaseSnap = await transaction.get(adminDb.collection("cbam_cases").doc(caseId));
      if (!freshCaseSnap.exists) throw new Error("CASE_NOT_FOUND");
      const freshCase = freshCaseSnap.data() as Record<string, unknown>;
      const freshOwner = String(freshCase.uid || freshCase.ownerId || "");
      if (!freshOwner || freshOwner !== decoded.uid) {
        throw new Error("CASE_OWNERSHIP_MISMATCH");
      }
      const freshCommercial = (freshCase.commercial || {}) as Record<string, unknown>;
      if (String(freshCommercial.status || "").toUpperCase() === "PAID") {
        throw new Error("CASE_ALREADY_PAID");
      }
      transaction.create(orderRef, {
        orderId,
        uid: decoded.uid,
        caseId,
        productCode: canonicalProductCode,
        canonicalProductCode,
        paddlePriceId: priceId,
        currency: "USD",
        amountMinor: CANONICAL_PRICING.amountMinor,
        status: "CHECKOUT_CREATED",
        createdAt: now,
        updatedAt: now,
        catalogVersion: "v5",
        correlationId,
        checkoutMode: "items",
        billingModel: "CASE_PAY_AT_LOCK",
      });
    });

    // Prefer server-created Paddle transaction when API key has transaction.write.
    // Many sandbox keys only have transaction.read — fall back to items overlay.
    const transactionUrl = paddleConfig.isSandbox
      ? "https://sandbox-api.paddle.com/transactions"
      : "https://api.paddle.com/transactions";

    try {
      const paddleRes = await fetch(transactionUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paddleConfig.apiKey}`,
          "Content-Type": "application/json",
          "Paddle-Version": "1",
        },
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity: 1 }],
          custom_data: { orderId, correlationId, caseId },
          ...(decoded.email ? { customer: { email: decoded.email } } : {}),
        }),
      });

      if (paddleRes.ok) {
        const responseData = await paddleRes.json();
        const transactionId = responseData?.data?.id as string | undefined;
        if (transactionId) {
          await orderRef.update({
            paddleTransactionId: transactionId,
            status: "PAYMENT_PENDING",
            checkoutMode: "transaction",
            updatedAt: new Date().toISOString(),
          });
          const success: CheckoutSuccess = {
            mode: "transaction",
            orderId,
            correlationId,
            priceId,
            transactionId,
          };
          return apiSuccess(success);
        }
      } else {
        const errorText = await paddleRes.text();
        console.warn(
          "[PADDLE API TRANSACTION CREATE UNAVAILABLE — using items checkout]:",
          paddleRes.status,
          errorText.slice(0, 400)
        );
      }
    } catch (paddleError: unknown) {
      console.warn("[PADDLE API TRANSACTION CREATE ERROR — using items checkout]:", paddleError);
    }

    await orderRef.update({
      status: "PAYMENT_PENDING",
      checkoutMode: "items",
      updatedAt: new Date().toISOString(),
    });

    const success: CheckoutSuccess = {
      mode: "items",
      orderId,
      correlationId,
      priceId,
    };
    return apiSuccess(success);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PADDLE CHECKOUT UNEXPECTED SERVER ERROR]:", message);
    if (message === "CASE_NOT_FOUND") {
      return apiFailure("CASE_NOT_FOUND", "Working file not found for checkout.", 404);
    }
    if (message === "CASE_OWNERSHIP_MISMATCH") {
      return apiFailure("CASE_OWNERSHIP_MISMATCH", "You do not own this working file.", 403);
    }
    if (message === "CASE_ALREADY_PAID") {
      return apiFailure(
        "CASE_ALREADY_PAID",
        "This working file is already paid. Return to the file and lock it — do not pay again.",
        409
      );
    }
    return apiFailure("INTERNAL_SERVER_ERROR", "Checkout could not be started.", 500);
  }
}
