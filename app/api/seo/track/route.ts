import { NextResponse } from "next/server";
import { SEO_CONVERSION_EVENTS, type SeoConversionEvent } from "@/lib/seo/analytics-events";
import { emitPurchaseAnalyticsExactlyOnce } from "@/lib/seo/purchase-analytics-idempotency";
import { createFirestorePurchaseAnalyticsStore } from "@/lib/seo/firestore-purchase-analytics-store";

export const runtime = "nodejs";

const ALLOWED = new Set<string>(SEO_CONVERSION_EVENTS);

function logConversion(payload: Record<string, unknown>): void {
  console.info(JSON.stringify({ type: "seo_conversion_event", ...payload, ts: new Date().toISOString() }));
}

async function maybeMeasurementProtocol(params: {
  eventName: string;
  transactionId: string;
  value: number;
}): Promise<void> {
  const mpSecret = process.env.GA4_MEASUREMENT_PROTOCOL_SECRET;
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!mpSecret || !measurementId) return;
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(mpSecret)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: "cbamvalid_server",
          events: [
            {
              name: params.eventName,
              params: {
                transaction_id: params.transactionId,
                value: params.value,
                currency: "USD",
                engagement_time_msec: 1,
              },
            },
          ],
        }),
      },
    );
  } catch {
    // First-party persistent claim already recorded; MP augment must not break UX.
  }
}

/**
 * First-party SEO conversion intake.
 * Purchase events use persistent Firestore idempotency (analytics_purchase:${transactionId}).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const event = (body as { event?: unknown }).event;
  if (typeof event !== "string" || !ALLOWED.has(event)) {
    return NextResponse.json({ error: "unknown_event" }, { status: 400 });
  }

  const payload = body as {
    event: SeoConversionEvent;
    transaction_id?: unknown;
    event_id?: unknown;
    value?: unknown;
    currency?: unknown;
    landing_page?: unknown;
    source?: unknown;
    medium?: unknown;
    campaign?: unknown;
    referrer?: unknown;
    items?: unknown;
  };

  const isPurchase = payload.event === "seo_purchase" || payload.event === "purchase";

  if (!isPurchase) {
    logConversion({
      event: payload.event,
      landing_page: typeof payload.landing_page === "string" ? payload.landing_page : undefined,
      source: typeof payload.source === "string" ? payload.source : undefined,
      medium: typeof payload.medium === "string" ? payload.medium : undefined,
      campaign: typeof payload.campaign === "string" ? payload.campaign : undefined,
      referrer: typeof payload.referrer === "string" ? payload.referrer : undefined,
    });
    return new NextResponse(null, { status: 204 });
  }

  if (typeof payload.transaction_id !== "string" || payload.transaction_id.length < 4) {
    return NextResponse.json({ error: "purchase_requires_transaction_id" }, { status: 400 });
  }
  if (typeof payload.value !== "number" && typeof payload.value !== "string") {
    return NextResponse.json({ error: "purchase_requires_value" }, { status: 400 });
  }
  if (payload.currency !== "USD") {
    return NextResponse.json({ error: "purchase_currency_must_be_USD" }, { status: 400 });
  }

  const store = createFirestorePurchaseAnalyticsStore();
  const result = await emitPurchaseAnalyticsExactlyOnce(
    store,
    {
      transactionId: payload.transaction_id,
      eventId: typeof payload.event_id === "string" ? payload.event_id : undefined,
      value: payload.value,
      currency: "USD",
      landingPage: typeof payload.landing_page === "string" ? payload.landing_page : undefined,
      source: typeof payload.source === "string" ? payload.source : undefined,
      medium: typeof payload.medium === "string" ? payload.medium : undefined,
      campaign: typeof payload.campaign === "string" ? payload.campaign : undefined,
      referrer: typeof payload.referrer === "string" ? payload.referrer : undefined,
      emitter: "api_seo_track",
    },
    async (record) => {
      logConversion({
        event: "purchase",
        transaction_id: record.transactionId,
        event_id: record.eventId,
        value: record.value,
        currency: record.currency,
        landing_page: record.landingPage,
        source: record.source,
        medium: record.medium,
        campaign: record.campaign,
        referrer: record.referrer,
        emitter: record.emitter,
        idempotencyKey: record.idempotencyKey,
        items: Array.isArray(payload.items) ? payload.items : undefined,
      });
      await maybeMeasurementProtocol({
        eventName: "purchase",
        transactionId: record.transactionId,
        value: record.value,
      });
    },
  );

  if (result.status === "duplicate") {
    return NextResponse.json(
      {
        status: "duplicate",
        transaction_id: payload.transaction_id,
        emissionDelta: 0,
        idempotencyKey: result.record.idempotencyKey,
      },
      { status: 200, headers: { "x-seo-purchase-dedup": "persistent-hit" } },
    );
  }

  return NextResponse.json(
    {
      status: "emitted",
      transaction_id: payload.transaction_id,
      emissionDelta: 1,
      idempotencyKey: result.record.idempotencyKey,
    },
    { status: 200, headers: { "x-seo-purchase-dedup": "persistent-miss" } },
  );
}
