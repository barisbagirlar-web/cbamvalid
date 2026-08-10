import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureAcquisitionFromLocation,
  trackSeoEvent,
} from "../../lib/seo/analytics-events";

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function installBrowser(consent: "granted" | "denied" | null) {
  const localStorage = storage(consent ? { cbamvalid_analytics_consent: consent } : {});
  const sessionStorage = storage();
  const dataLayer: Array<Record<string, unknown>> = [];
  const fakeWindow = {
    localStorage,
    sessionStorage,
    dataLayer,
    location: {
      href: "https://cbamvalid.com/product?utm_source=google&utm_medium=organic",
      pathname: "/product",
    },
    gtag: vi.fn(),
  };
  Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
  Object.defineProperty(globalThis, "document", {
    value: { referrer: "https://www.google.com/search?q=cbam" },
    configurable: true,
  });
  return { fakeWindow, sessionStorage, dataLayer };
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "window");
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "fetch");
});

describe("Phase 14 analytics consent boundary", () => {
  it.each([null, "denied"] as const)("does not store or deliver analytics while consent=%s", (consent) => {
    const { sessionStorage, dataLayer } = installBrowser(consent);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, "fetch", { value: fetchSpy, configurable: true });

    expect(captureAcquisitionFromLocation()).toEqual({});
    trackSeoEvent("page_view", { source: "fixture" });

    expect(sessionStorage.getItem("cbamvalid_seo_acquisition_v1")).toBeNull();
    expect(dataLayer).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("starts storage and delivery only after explicit grant", () => {
    const { sessionStorage, dataLayer } = installBrowser("granted");
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, "fetch", { value: fetchSpy, configurable: true });

    const dims = captureAcquisitionFromLocation();
    trackSeoEvent("page_view", dims);

    expect(sessionStorage.getItem("cbamvalid_seo_acquisition_v1")).not.toBeNull();
    expect(dataLayer.some((row) => row.event === "page_view")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("/api/seo/track", expect.objectContaining({ method: "POST" }));
  });
});
