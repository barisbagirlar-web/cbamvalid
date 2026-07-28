"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  captureAcquisitionFromLocation,
  getAnalyticsConsent,
  trackSeoEvent,
} from "@/lib/seo/analytics-events";

function loadGtag(measurementId: string): void {
  if (typeof window === "undefined") return;
  if (document.getElementById("cbamvalid-gtag")) return;
  const script = document.createElement("script");
  script.id = "cbamvalid-gtag";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args as unknown as Record<string, unknown>);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true });
}

/**
 * Side-effect-only analytics beacon.
 * Must NOT wrap page children — useSearchParams suspends and would strip SSR HTML.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const dims = captureAcquisitionFromLocation();
    trackSeoEvent("page_view", dims);
    if (pathname === "/" || pathname.startsWith("/cbam-") || pathname.startsWith("/cn-code")) {
      trackSeoEvent("organic_landing_view", dims);
    }
    if (pathname === "/product") trackSeoEvent("seo_to_product", dims);
    if (pathname === "/pricing") trackSeoEvent("seo_to_pricing", dims);
    if (pathname === "/register") trackSeoEvent("seo_to_register", dims);
    if (pathname.startsWith("/cases/new")) trackSeoEvent("dossier_start", dims);

    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (measurementId && getAnalyticsConsent() === "granted") {
      loadGtag(measurementId);
    }
  }, [pathname, searchParams]);

  return null;
}
