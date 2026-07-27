/**
 * Conversion event names for SEO acquisition measurement.
 * Wire to analytics only through this registry — do not invent ad-hoc event strings in pages.
 */
export const SEO_CONVERSION_EVENTS = [
  "seo_landing_view",
  "seo_to_product",
  "seo_to_pricing",
  "seo_to_register",
  "seo_to_case_start",
  "seo_to_checkout",
  "seo_purchase",
] as const;

export type SeoConversionEvent = (typeof SEO_CONVERSION_EVENTS)[number];

export interface SeoAcquisitionDimensions {
  readonly landingPage?: string;
  readonly referrer?: string;
  readonly utm_source?: string;
  readonly utm_medium?: string;
  readonly utm_campaign?: string;
  readonly searchEngine?: string;
  readonly AIReferrer?: string;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackSeoEvent(event: SeoConversionEvent, dims: SeoAcquisitionDimensions = {}): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...dims });
}
