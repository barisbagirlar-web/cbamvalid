import { NextRequest, NextResponse } from "next/server";
import { getSessionRevocationSensitive } from "@/lib/auth/session-cookie";
import { getPriceIdForProduct, PRODUCT_CATALOG } from "@/lib/commerce/catalog";
import { paddle, isSandboxMode } from "@/lib/commerce/paddle-client";
import { verifyCaseOwner } from "@/lib/cbam/storage/case-repository";
import { adminDb } from "@/lib/firebase/admin";
import { createOrder } from "@/lib/commerce/order-service";

export const dynamic = "force-dynamic";

function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") || "";
  const allowed = process.env.AUTH_ALLOWED_ORIGINS || "";
  const allowedList = allowed.split(",").map((o) => o.trim().toLowerCase());
  return allowedList.includes(origin.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    // 1. Same-Origin Check
    if (!verifyOrigin(request)) {
      return NextResponse.json({ error: "Forbidden: Invalid origin policy." }, { status: 403 });
    }

    // 2. Session check
    const session = await getSessionRevocationSensitive();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Request inputs validation
    const { productCode, caseId } = await request.json();

    if (!productCode || !caseId) {
      return NextResponse.json({ error: "Missing productCode or caseId parameter" }, { status: 400 });
    }

    // 4. Validate product catalogue settings (Mapped product code: CBAM_EXPORTER_FINAL_REPORT)
    const product = PRODUCT_CATALOG[productCode];
    if (!product || !product.active) {
      return NextResponse.json({ error: "Product is inactive or invalid" }, { status: 400 });
    }

    // 5. Confirm draft case ownership
    await verifyCaseOwner(caseId, session.uid);

    // 6. Get mapped Price ID from server config
    const isSandbox = isSandboxMode();
    const priceId = getPriceIdForProduct(productCode, isSandbox);
    if (!priceId) {
      return NextResponse.json({ error: "Price mapping missing for the requested product code" }, { status: 500 });
    }

    // 7. Atomic transaction to create order and invoke Paddle checkout creation
    const result = await adminDb.runTransaction(async (dbTransaction: any) => {
      // Create server-side tracking order
      const order = await createOrder(dbTransaction, {
        uid: session.uid,
        caseId: caseId,
        productCode: productCode,
        currency: product.currency,
        amountMinor: product.expectedUnitAmount,
      });

      return order;
    });

    // 8. Create transaction with custom data metadata using official Paddle SDK
    const paddleTransaction = await paddle.transactions.create({
      items: [
        {
          priceId: priceId,
          quantity: 1,
        },
      ],
      customData: {
        uid: session.uid,
        orderId: result.orderId,
        caseId: caseId,
        productCode: productCode,
        environment: isSandbox ? "sandbox" : "production",
      },
    });

    // Update order with the generated transaction ID
    await adminDb.collection("commerce_orders").doc(result.orderId).update({
      paddleTransactionId: paddleTransaction.id,
      status: "PAYMENT_PENDING",
    });

    // 9. Return only safe data required to open Paddle.js checkout
    return NextResponse.json({
      status: "success",
      orderId: result.orderId,
      transactionId: paddleTransaction.id,
      priceId: priceId,
    });
  } catch (error: any) {
    console.error("[CHECKOUT CREATION ERROR]:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to create checkout session" }, { status: 500 });
  }
}
