import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "WEBHOOK_ROUTE_RETIRED",
        message: "Paddle webhooks must be delivered directly to the verified europe-west1 paddleWebhook Cloud Function.",
      },
    },
    { status: 410 }
  );
}
