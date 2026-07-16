import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "CHECKOUT_ROUTE_RETIRED",
        message: "Checkout is available only through the authenticated createCheckoutSession Cloud Function.",
      },
    },
    { status: 410 }
  );
}
