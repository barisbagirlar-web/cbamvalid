/**
 * Extreme-scenario playbook — honest B2B positions that protect revenue and trust.
 * Do not invent SLA %, multi-region DR, fuzz coverage, or unlimited free remakes.
 */

export type EdgeCaseStatus =
  | "CODE_PROVEN"
  | "PARTIAL"
  | "OWNER_ACTION"
  | "EMPTY_BY_DESIGN"
  | "EXTERNAL_BLOCKER";

export type EdgeCaseRecord = {
  id: string;
  title: string;
  scenario: string;
  status: EdgeCaseStatus;
  commercialPosition: string;
  technicalPosition: string;
  moneyRule: string;
  publicHref?: string;
};

export const EDGE_CASE_PLAYBOOK: readonly EdgeCaseRecord[] = [
  {
    id: "deadline-night-surge",
    title: "Deadline-night surge (e.g. 29 Sep 2027 CET)",
    scenario:
      "Thousands of concurrent lock + PDF/XLSX renders hit cold starts and Firestore quotas; seal queues stall while “failed locks charge nothing” remains true.",
    status: "PARTIAL",
    commercialPosition:
      "Failed or blocked seals do not consume the paid unlock. That is not a capacity or deadline-guarantee SLA. Customers who wait until declaration week own their calendar risk.",
    technicalPosition:
      "Production runs on Google Cloud / Firebase in europe-west1 with platform quotas. No contractual multi-region capacity reservation or published peak-RPS warranty exists.",
    moneyRule:
      "Sell early-lock behaviour. Do not market “we absorb deadline night.” Support P0 covers paid customers who cannot seal after payment — not damages for late filing.",
    publicHref: "/status",
  },
  {
    id: "double-checkout-race",
    title: "Double-tab checkout race",
    scenario:
      "Two browser tabs start checkout for the same working file (caseId) and Paddle could create two charges.",
    status: "CODE_PROVEN",
    commercialPosition:
      "Duplicate charges for the same Working File unlock are refundable. Prevention is preferred: one open checkout lock per uid+caseId on the live `/api/checkout/cbam` path.",
    technicalPosition:
      "Live pay flow (`/credits/buy` → `/api/checkout/cbam`) claims a per-(uid, caseId) `commerce_checkout_locks` document (2h TTL). A second tab reuses the open order/transaction; fulfilled locks return CASE_ALREADY_PAID; unused refunds supersede the lock for repurchase.",
    moneyRule: "Prevent double charge on the production checkout route first; refund only the residual duplicate.",
    publicHref: "/refund-policy",
  },
  {
    id: "chargeback-after-download",
    title: "Chargeback after sealed download",
    scenario:
      "Customer downloads an immutable sealed package, then opens a card dispute. Bytes cannot be clawed back.",
    status: "PARTIAL",
    commercialPosition:
      "After a successful sealed delivery, withdrawal is excluded for that digital package under the refund policy. Chargebacks are handled via Paddle (MoR); CBAMValid contests abusive disputes with delivery/hash evidence.",
    technicalPosition:
      "Sealed objects and public verification hashes remain immutable integrity records. Deleting the buyer’s local copy is outside CBAMValid control.",
    moneyRule:
      "Loss after proven delivery sits with the disputing payer / card network process — not as a silent free product. Document delivery evidence for MoR contests.",
    publicHref: "/refund-policy",
  },
  {
    id: "ruleset-mid-draft",
    title: "Ruleset changes while a draft is open",
    scenario:
      "Draft started under ruleset v1; v2 becomes the sealable path; user locks assuming v1 without noticing.",
    status: "CODE_PROVEN",
    commercialPosition:
      "Seals pin the ruleset/engine/legal-source hash at lock time. Historical seals are never rewritten. Same-file re-locks are for ordinary corrections — not unlimited free remakes for every mid-year EU act. The wizard shows a ruleset-pin banner on the draft so the sealable pin is visible before lock.",
    technicalPosition:
      "Seal pipeline pins named ruleset versions. Draft UI surfaces the active sealable pin via `ruleset-pin-banner`; silent methodology rewrite of historical seals is prohibited by design.",
    moneyRule: "Pinned ≠ perpetual current law. Price corrections for EU methodology shocks separately if free remakes would bankrupt support.",
    publicHref: "/rulesets",
  },
  {
    id: "malicious-input-fuzz",
    title: "Malicious / extreme inputs",
    scenario:
      "Negative emissions, 1e12 tonnes, Unicode/RTL names, 10k evidence files, corrupt XLSX imports.",
    status: "PARTIAL",
    commercialPosition:
      "QC is fail-closed for material blockers: unsupported or absurd inputs must not become silent zeros that look sealable.",
    technicalPosition:
      "Validation and readiness gates block sealing on material gaps. A published third-party fuzz corpus is not claimed; OWNER_ACTION remains to expand automated adversarial suites.",
    moneyRule: "Do not claim “fuzz-proof.” Claim fail-closed sealing for known material classes with continuous gate expansion.",
    publicHref: "/security",
  },
  {
    id: "verify-oracle",
    title: "Verify / buyer-link oracle",
    scenario:
      "Attacker enumerates /verify tokens or times hash lookups; buyer-link predictability.",
    status: "CODE_PROVEN",
    commercialPosition:
      "Buyer links are capability URLs for integrity inspection — not a public search index of all seals.",
    technicalPosition:
      "Public tokens are 32-byte CSPRNG values (64 hex). Lookups use SHA-256 hashes; plaintext tokens are not stored as queryable plaintext. No customer-facing dedicated rate-limit product is published (platform + auth/App Check when enforced).",
    moneyRule: "Token entropy is the primary control; do not invent a WAF/rate-limit product you do not run.",
    publicHref: "/buyer-link",
  },
  {
    id: "session-theft-xss",
    title: "Session riding via stored XSS",
    scenario:
      "Weak CSP + rendered evidence filename XSS steals HttpOnly session riding.",
    status: "PARTIAL",
    commercialPosition:
      "Sessions use Firebase → HttpOnly `__session` cookies. Production script-src is nonce + strict-dynamic without unsafe-inline/eval.",
    technicalPosition:
      "style-src still allows unsafe-inline for React style attributes. Evidence names and user text must remain escaped in UI. No pen-test report is published.",
    moneyRule: "Keep CSP honest; never claim pen-tested XSS-proof. Fix escape bugs as P0 when found.",
    publicHref: "/security",
  },
  {
    id: "region-death",
    title: "europe-west1 regional outage",
    scenario:
      "Primary region fails; re-download promises cannot be served; declaration week with no DR.",
    status: "EMPTY_BY_DESIGN",
    commercialPosition:
      "No multi-region active/active DR or contractual uptime % is sold. Continuity is best-effort on Google Cloud / Firebase durability. Customers should retain local sealed copies after download.",
    technicalPosition:
      "Runtime and data plane are configured for europe-west1. Provider status pages are the upstream incident source.",
    moneyRule: "Do not sell “always re-downloadable under regional death.” Sell immutable local custody after download.",
    publicHref: "/status",
  },
  {
    id: "gdpr-vs-verify",
    title: "GDPR erasure vs verify integrity",
    scenario:
      "Account deletion requested while buyer still needs verify hash for a shared sealed package.",
    status: "PARTIAL",
    commercialPosition:
      "Account erasure proceeds for personal account data. Sealed packages already shared with buyers may remain with recipients under their retention duties. Integrity hashes needed for public verify may be retained as integrity metadata under the published retention model — not as a marketing profile.",
    technicalPosition:
      "Security/DPA surfaces state deletion contacts and the shared-package retention edge. Exact retention clocks are recorded on sealed packages (retentionUntil).",
    moneyRule: "Publish the collision honestly; do not promise both “instant total erase” and “eternal public verify” without a retention rule.",
    publicHref: "/security",
  },
  {
    id: "eua-price-feed-outage",
    title: "Certificate / EUA price feed outage",
    scenario:
      "Quarterly average certificate price source is delayed; what value enters the seal?",
    status: "PARTIAL",
    commercialPosition:
      "Seals pin the certificate-price dataset / snapshot version recorded at seal time. CBAMValid does not invent a live market tick as “official CBAM certificate price.”",
    technicalPosition:
      "Regulatory snapshot service carries an explicit certificatePriceDatasetVersion. Missing material carbon-price evidence fails closed into readiness gaps rather than silent deductions.",
    moneyRule: "Pin and disclose the dataset version; never silently substitute an unverified live feed.",
    publicHref: "/cbam-certificate-price",
  },
  {
    id: "delegated-act-shock",
    title: "Delegated/implementing act shock (default values etc.)",
    scenario:
      "Commission updates defaults/methods; every historical seal looks “stale”; customers demand unlimited free re-locks and support floods.",
    status: "CODE_PROVEN",
    commercialPosition:
      "Historical seals stay immutable under their pin. Same-file correction re-locks cover ordinary data/evidence corrections — not an unlimited free obligation to re-engineer every mid-year regulatory change.",
    technicalPosition:
      "Ruleset registry + seal pins enforce reproducibility. Newer sealable pins require re-calculation under that pin; prior seals remain downloadable historical evidence.",
    moneyRule:
      "Defend margin: free remakes for EU law shocks are a product decision with caps — never an open-ended promise in public copy.",
    publicHref: "/rulesets",
  },
] as const;

export function edgeCaseStatusCounts(): Record<EdgeCaseStatus, number> {
  const counts: Record<EdgeCaseStatus, number> = {
    CODE_PROVEN: 0,
    PARTIAL: 0,
    OWNER_ACTION: 0,
    EMPTY_BY_DESIGN: 0,
    EXTERNAL_BLOCKER: 0,
  };
  for (const row of EDGE_CASE_PLAYBOOK) counts[row.status] += 1;
  return counts;
}
