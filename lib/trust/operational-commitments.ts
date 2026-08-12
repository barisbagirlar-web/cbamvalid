/**
 * Honest operational commitments for B2B trust inventory.
 * Never invent uptime %, pen-test reports, or commercial WAF subscriptions.
 */

export type SupportPriority = {
  id: "P0" | "P1" | "P2" | "P3";
  label: string;
  definition: string;
  firstResponse: string;
  resolutionTarget: string;
};

export const SUPPORT_RESPONSE_TARGETS: readonly SupportPriority[] = [
  {
    id: "P0",
    label: "Critical",
    definition: "Paid customer cannot generate a sealed package or complete checkout after payment",
    firstResponse: "4 business hours",
    resolutionTarget: "1 business day",
  },
  {
    id: "P1",
    label: "High",
    definition: "Verification/hash failure or reproducible blocker in dossier generation",
    firstResponse: "1 business day",
    resolutionTarget: "3 business days",
  },
  {
    id: "P2",
    label: "Medium",
    definition: "Methodology or content questions about the software outputs",
    firstResponse: "2 business days",
    resolutionTarget: "5 business days",
  },
  {
    id: "P3",
    label: "Low",
    definition: "General product questions or non-blocking feature requests",
    firstResponse: "3 business days",
    resolutionTarget: "Next scheduled release window",
  },
] as const;

export const SUPPORT_WINDOW = {
  hours: "09:00–18:00 Europe/Dublin",
  days: "Monday–Friday, excluding Irish public holidays",
  channel: "email",
  warranty:
    "Targets are operational response goals for software support — not a contractual availability or damages SLA.",
} as const;

export const STATUS_PUBLIC = {
  path: "/status",
  headline: "Service status — dependency facts",
  lede:
    "CBAMValid production runtime depends on Google Cloud / Firebase in europe-west1. This page publishes dependency and incident facts without inventing an uptime percentage.",
  googleCloudStatusUrl: "https://status.cloud.google.com/",
  firebaseStatusUrl: "https://status.firebase.google.com/",
  noUptimeSla:
    "No contractual availability percentage (for example 99.9%) is published. Continuity is best-effort on the listed cloud providers.",
  noExternalStatusVendor:
    "No separate commercial status-page vendor (Statuspage, Better Stack, etc.) is currently engaged.",
} as const;

export const SECURITY_ASSURANCE_FACTS = {
  penTest:
    "No independent penetration-test report is published. When one exists, issuer, scope, and date will be listed here.",
  waf:
    "No commercial WAF subscription is claimed. Edge and application controls currently include Firebase Hosting / Cloud Run, optional Firebase App Check / reCAPTCHA, authentication gates, and a nonce-based CSP.",
  rateLimit:
    "No customer-facing dedicated API rate-limit product is published. Abuse resistance relies on authentication, App Check (when enforced), and platform quotas.",
} as const;
