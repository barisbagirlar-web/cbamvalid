/**
 * GDPR Art. 28 sub-processor inventory SSOT.
 * Only list providers that process personal data for the production service.
 * Do not invent Sentry/ESP entries that are not engaged.
 */

export type SubprocessorCategory =
  | "infrastructure"
  | "payments"
  | "analytics"
  | "security"
  | "communications"
  | "observability";

export type SubprocessorRecord = {
  id: string;
  name: string;
  category: SubprocessorCategory;
  role: string;
  personalDataNote: string;
  regionNote: string;
};

export const SUBPROCESSORS: readonly SubprocessorRecord[] = [
  {
    id: "gcp-firebase",
    name: "Google Cloud / Firebase",
    category: "infrastructure",
    role:
      "Application hosting, Firebase Authentication, Firestore, Cloud Storage, Cloud Functions / Cloud Run, and platform operations",
    personalDataNote:
      "Account identifiers, authentication metadata, customer-controlled working-file contents, and operational telemetry required to run the service",
    regionNote: "Primary application region: europe-west1 (EU)",
  },
  {
    id: "gcp-logging",
    name: "Google Cloud Logging / Firebase operations tooling",
    category: "observability",
    role: "Application, function, and platform logs used for debugging, security review, and reliability",
    personalDataNote:
      "May include request metadata, authenticated user IDs, IP-related edge metadata, and error context. No separate third-party APM (for example Sentry) is currently engaged.",
    regionNote: "Processed in Google Cloud / Firebase operations regions supporting the project",
  },
  {
    id: "google-app-check",
    name: "Google App Check / reCAPTCHA",
    category: "security",
    role: "Abuse and bot resistance for protected endpoints when App Check enforcement is enabled",
    personalDataNote: "Device/browser attestation signals and related security telemetry",
    regionNote: "Google security services regions",
  },
  {
    id: "google-analytics",
    name: "Google Analytics 4",
    category: "analytics",
    role: "Privacy-consent-gated product and marketing analytics (gtag / GA4)",
    personalDataNote:
      "Only after analytics consent is granted: page/event telemetry with IP anonymization configured in the GA bootstrap",
    regionNote: "Google Analytics processing regions per Google terms",
  },
  {
    id: "paddle",
    name: "Paddle",
    category: "payments",
    role: "Merchant of Record for paid checkout, tax invoicing, refunds, and related billing communications",
    personalDataNote: "Buyer identity, billing details, and transaction records processed by Paddle as MoR",
    regionNote: "Paddle processing regions per Paddle DPA",
  },
  {
    id: "paddle-retain",
    name: "Paddle Retain / ProfitWell",
    category: "analytics",
    role: "Paddle-linked retention and payment-recovery tooling allowed by the production CSP for Paddle checkout surfaces",
    personalDataNote: "Billing/recovery signals associated with Paddle-managed customers where Retain is active",
    regionNote: "Paddle / ProfitWell processing regions",
  },
  {
    id: "firebase-auth-mail",
    name: "Firebase Authentication email delivery (Google)",
    category: "communications",
    role: "Account emails such as password-reset and authentication messages",
    personalDataNote:
      "Email address and authentication message content. No separate ESP (Resend, SendGrid, Postmark, etc.) is currently engaged for product mail.",
    regionNote: "Google / Firebase Authentication email delivery infrastructure",
  },
] as const;

export function subprocessorsByCategory(
  category: SubprocessorCategory,
): readonly SubprocessorRecord[] {
  return SUBPROCESSORS.filter((row) => row.category === category);
}
