import { NextResponse } from "next/server";
import { PRODUCT_CATALOG } from "@/lib/commerce/catalog";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Basic ping to Firestore to test connection health
    await adminDb.collection("commerce_orders").limit(1).get();

    return NextResponse.json({
      status: "ok",
      commerceEngine: "active",
      catalogProductsCount: Object.keys(PRODUCT_CATALOG).length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: error.message || "Failed to reach commerce datastore",
    }, { status: 500 });
  }
}
