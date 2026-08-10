/**
 * Conversion event names for SEO acquisition measurement.
 * Wire to analytics only through this registry — do not invent ad-hoc event strings in pages.
 */
export const SEO_CONVERSION_EVENTS = [
  "page_view",
  "organic_landing_view",
  "seo_landing_view",
  "view_item",
  "seo_to_product",
  "seo_to_pricing",
  "seo_to_register",
  "seo_to_case_start",
  "dossier_start",
  "begin_checkout",
  "checkout_start",
  "seo_to_checkout",
  "purchase",
  "seo_purchase",
] as const;

export type SeoConversionEvent = (typeof SEO_CONVERSION_EVENTS)[number];

export interface SeoAcquisitionDimensions {
  landingPage?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  searchEngine?: string;
  AIReferrer?: string;
  transaction_id?: string;
  value?: number | string;
  currency?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  items?: readonly { item_id?: string; item_name?: string; price?: number; quantity?: number }[];
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
    __cbamSeoAcquisition?: SeoAcquisitionDimensions;
  }
}

const ACQUISITION_KEY = "cbamvalid_seo_acquisition_v1";
const CONSENT_KEY = "cbamvalid_analytics_consent";

export function getAnalyticsConsent(): "granted" | "denied" | "unset" {
  if (typeof window === "undefined") return "unset";
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (raw === "granted" || raw === "denied") return raw;
  } catch {
    return "unset";
  }
  return "unset";
}

export function setAnalyticsConsent(value: "granted" | "denied"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
    if (value === "denied") {
      window.sessionStorage.removeItem(ACQUISITION_KEY);
      delete window.__cbamSeoAcquisition;
    }
  } catch {
    // Storage may be unavailable in hardened/private browsing contexts.
  }
}

function mapLegacyEvent(event: SeoConversionEvent): SeoConversionEvent {
  if (event === "seo_to_case_start") return "dossier_start";
  if (event === "seo_to_checkout" || event === "checkout_start") return "begin_checkout";
  if (event === "seo_purchase") return "purchase";
  if (event === "seo_landing_view") return "organic_landing_view";
  return event;
}

function readStoredAcquisition(): SeoAcquisitionDimensions {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted") return {};
  try {
    const raw = window.sessionStorage.getItem(ACQUISITION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as SeoAcquisitionDimensions;
  } catch {
    return {};
  }
}

export function captureAcquisitionFromLocation(): SeoAcquisitionDimensions {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted") return {};
  const url = new URL(window.location.href);
  const dims: SeoAcquisitionDimensions = {
    landingPage: `${url.pathname}${url.search}`,
    referrer: document.referrer || undefined,
    utm_source: url.searchParams.get("utm_source") ?? undefined,
    utm_medium: url.searchParams.get("utm_medium") ?? undefined,
    utm_campaign: url.searchParams.get("utm_campaign") ?? undefined,
    source: url.searchParams.get("utm_source") ?? undefined,
    medium: url.searchParams.get("utm_medium") ?? undefined,
    campaign: url.searchParams.get("utm_campaign") ?? undefined,
  };
  const ref = (document.referrer || "").toLowerCase();
  if (/google\.|bing\.|duckduckgo\.|yahoo\./.test(ref)) {
    dims.searchEngine = "organic_search";
  }
  if (/chatgpt\.|perplexity\.|claude\.|bing\.com\/chat|openai\./.test(ref)) {
    dims.AIReferrer = "ai_referral";
  }
  try {
    window.sessionStorage.setItem(ACQUISITION_KEY, JSON.stringify(dims));
  } catch {
    // Measurement storage failure must not affect UX.
  }
  window.__cbamSeoAcquisition = dims;
  return dims;
}

function pushGa4(event: SeoConversionEvent, payload: Record<string, unknown>): void {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId || getAnalyticsConsent() !== "granted") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", event, payload);
}

/**
 * Consent-gated dual delivery:
 * 1) First-party /api/seo/track (persistent Firestore dedup for purchase)
 * 2) dataLayer + GA4 gtag when measurement ID is configured
 *
 * No acquisition storage, dataLayer event, first-party analytics request, or GA4 event
 * is produced until the visitor explicitly grants analytics consent.
 * Purchase exactly-once is enforced server-side; client never claims authority.
 */
export function trackSeoEvent(event: SeoConversionEvent, dims: SeoAcquisitionDimensions = {}): void {
  if (typeof window === "undefined" || getAnalyticsConsent() !== "granted") return;

  const normalized = mapLegacyEvent(event);
  const stored = readStoredAcquisition();
  const merged: SeoAcquisitionDimensions = { ...stored, ...dims };

  const payload = {
    event: normalized,
    landing_page: merged.landingPage ?? window.location.pathname,
    referrer: merged.referrer ?? document.referrer,
    source: merged.source ?? merged.utm_source,
    medium: merged.medium ?? merged.utm_medium,
    campaign: merged.campaign ?? merged.utm_campaign,
    transaction_id: merged.transaction_id,
    value: merged.value,
    currency: merged.currency,
    items: merged.items,
  };

  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ ...merged, ...payload, event: normalized });

  pushGa4(normalized, {
    transaction_id: payload.transaction_id,
    value: payload.value,
    currency: payload.currency ?? "USD",
    items: payload.items,
    landing_page: payload.landing_page,
    source: payload.source,
    medium: payload.medium,
    campaign: payload.campaign,
  });

  void fetch("/api/seo/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Fail open for UX; missing deliveries are observed through server logs/replay tests.
  });
}
