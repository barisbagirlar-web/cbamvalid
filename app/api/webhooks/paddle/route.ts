import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CLOUD_FUNCTION_WEBHOOK =
  process.env.PADDLE_WEBHOOK_FUNCTION_URL ||
  "https://europe-west1-cbam-desk.cloudfunctions.net/paddleWebhook";

/**
 * Production Paddle webhooks must hit the Cloud Function (raw body + signature).
 * This App Router route proxies to that function so a mis-pointed dashboard URL
 * still fulfills instead of silently acknowledging.
 */
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("paddle-signature");

    const response = await fetch(CLOUD_FUNCTION_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        ...(signature ? { "paddle-signature": signature } : {}),
      },
      body,
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook proxy failed";
    console.error("[PADDLE WEBHOOK PROXY ERROR]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
