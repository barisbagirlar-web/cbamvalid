import { apiFailure } from "@/lib/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return apiFailure(
    "CHECKOUT_ROUTE_RETIRED",
    "Checkout is created only through the authenticated createCheckoutSession callable.",
    410
  );
}

export async function GET() {
  return apiFailure("METHOD_NOT_ALLOWED", "Use the authenticated in-app purchase flow.", 405);
}
