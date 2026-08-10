"use client";

import { useEffect, useState } from "react";
import {
  captureAcquisitionFromLocation,
  getAnalyticsConsent,
  setAnalyticsConsent,
  trackSeoEvent,
} from "@/lib/seo/analytics-events";
import { consentModeUpdate, type ConsentChoice } from "./consent-mode";

function ensureGtagLoaded(): void {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId || typeof window === "undefined") return;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag(...args: unknown[]) {
    window.dataLayer?.push(args as unknown as Record<string, unknown>);
  };

  if (!document.getElementById("cbamvalid-gtag")) {
    const script = document.createElement("script");
    script.id = "cbamvalid-gtag";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { anonymize_ip: true });
  }
}

function resumeCurrentPageMeasurement(): void {
  const dims = captureAcquisitionFromLocation();
  trackSeoEvent("page_view", dims);
  const pathname = window.location.pathname;
  if (pathname === "/" || pathname.startsWith("/cbam-") || pathname.startsWith("/cn-code")) {
    trackSeoEvent("organic_landing_view", dims);
  }
  if (pathname === "/product") trackSeoEvent("seo_to_product", dims);
  if (pathname === "/pricing") trackSeoEvent("seo_to_pricing", dims);
  if (pathname === "/register") trackSeoEvent("seo_to_register", dims);
  if (pathname.startsWith("/cases/new")) trackSeoEvent("dossier_start", dims);
}

function applyChoice(choice: ConsentChoice): void {
  setAnalyticsConsent(choice);
  window.gtag?.("consent", "update", consentModeUpdate(choice));
  window.__cbamConsentModeV2 = { version: 2, choice, defaultDenied: true };
  if (choice === "granted") {
    ensureGtagLoaded();
    resumeCurrentPageMeasurement();
  }
}

export function AnalyticsConsentManager() {
  const [choice, setChoice] = useState<"unset" | ConsentChoice>("unset");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const current = getAnalyticsConsent();
    setChoice(current);
    setOpen(current === "unset");
  }, []);

  const select = (next: ConsentChoice) => {
    applyChoice(next);
    setChoice(next);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open analytics privacy settings"
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 70,
          border: "1px solid rgba(255,255,255,.22)",
          borderRadius: 999,
          padding: "8px 12px",
          background: "rgba(12,18,26,.94)",
          color: "#ffffff",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Privacy settings{choice === "granted" ? " · analytics on" : choice === "denied" ? " · analytics off" : ""}
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="analytics-consent-title"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 80,
        maxWidth: 720,
        margin: "0 auto",
        border: "1px solid rgba(255,255,255,.18)",
        borderRadius: 16,
        padding: 16,
        background: "rgba(12,18,26,.98)",
        color: "#ffffff",
        boxShadow: "0 18px 60px rgba(0,0,0,.35)",
      }}
    >
      <h2 id="analytics-consent-title" style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
        Analytics privacy
      </h2>
      <p style={{ margin: "8px 0 14px", fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,.78)" }}>
        Optional analytics helps us understand public-site usage. Advertising storage and personalization remain disabled. You can change this choice at any time.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={() => select("granted")}
          style={{ border: 0, borderRadius: 10, padding: "9px 14px", fontWeight: 700, cursor: "pointer" }}
        >
          Allow analytics
        </button>
        <button
          type="button"
          onClick={() => select("denied")}
          style={{ border: "1px solid rgba(255,255,255,.28)", borderRadius: 10, padding: "9px 14px", background: "transparent", color: "#ffffff", fontWeight: 700, cursor: "pointer" }}
        >
          Decline
        </button>
        {choice !== "unset" ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ border: 0, padding: "9px 10px", background: "transparent", color: "rgba(255,255,255,.7)", cursor: "pointer" }}
          >
            Close
          </button>
        ) : null}
      </div>
    </section>
  );
}
