import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canonicalWebhookUrl(): URL {
  const configured = process.env.PADDLE_WEBHOOK_FUNCTION_URL;
  if (!configured) {
    if (process.env.NODE_ENV === "development") {
      return new URL("http://127.0.0.1:5001/cbam-desk/europe-west1/paddleWebhook");
    }
    throw new Error("PADDLE_WEBHOOK_FUNCTION_URL_MISSING");
  }
  const url = new URL(configured);
  const allowedProductionHost =
    url.protocol === "https:" &&
    (url.hostname.endsWith(".cloudfunctions.net") || url.hostname.endsWith(".run.app"));
  const allowedLocalHost =
    process.env.NODE_ENV === "development" &&
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname);
  if (!allowedProductionHost && !allowedLocalHost) throw new Error("PADDLE_WEBHOOK_FUNCTION_URL_INVALID");
  if (!url.pathname.endsWith("/paddleWebhook")) throw new Error("PADDLE_WEBHOOK_FUNCTION_PATH_INVALID");
  return url;
}

export async function POST(request: Request) {
  const signature = request.headers.get("paddle-signature");
  if (!signature) {
    return NextResponse.json({ error: "PADDLE_SIGNATURE_MISSING" }, { status: 401 });
  }

  try {
    const body = await request.text();
    const upstream = await fetch(canonicalWebhookUrl(), {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        "Paddle-Signature": signature,
        "User-Agent": "CBAMValid-Webhook-Proxy/1.0",
      },
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
    const responseBody = await upstream.text();
    return new NextResponse(responseBody, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "PADDLE_WEBHOOK_PROXY_FAILED";
    console.error(`[PADDLE-WEBHOOK-PROXY] ${code}`);
    return NextResponse.json({ error: "PADDLE_WEBHOOK_PROXY_UNAVAILABLE" }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "METHOD_NOT_ALLOWED" }, {
    status: 405,
    headers: { Allow: "POST", "Cache-Control": "no-store" },
  });
}
