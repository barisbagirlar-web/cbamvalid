import { readFileSync } from "node:fs";
import { BlockList, isIP } from "node:net";
import { resolve } from "node:path";

export type BotFamily =
  | "googlebot"
  | "oai-searchbot"
  | "oai-adsbot"
  | "perplexitybot"
  | "perplexity-user"
  | "gptbot"
  | "claudebot"
  | "unknown";

export type BotObservation = {
  userAgent: string;
  sourceIp: string;
  reverseHostnames?: string[];
  forwardResolvedIps?: string[];
  providerManifest?: unknown;
  providerManifestSource?: string;
};

export type BotIdentityResult = {
  family: BotFamily;
  status: "VERIFIED" | "UNVERIFIED" | "NOT_BOT";
  reason: string;
  evidenceMethod: "reverse-forward-dns" | "published-ip-manifest" | "none";
  evidenceSource: string | null;
};

type Policy = {
  family: BotFamily;
  matcher: RegExp;
  method: "reverse-forward-dns" | "published-ip-manifest" | "none";
  source?: string;
  allowedDnsSuffixes?: string[];
};

/**
 * Provider verification sources are references, never cached IP ranges.
 * Current provider manifests can change, so observations must carry the exact
 * manifest used for the decision instead of relying on stale ranges in source control.
 */
export const BOT_VERIFICATION_POLICIES: readonly Policy[] = [
  {
    family: "googlebot",
    matcher: /\bGooglebot\b/i,
    method: "reverse-forward-dns",
    source: "https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests",
    allowedDnsSuffixes: [".googlebot.com", ".geo.googlebot.com"],
  },
  {
    family: "oai-searchbot",
    matcher: /\bOAI-SearchBot\b/i,
    method: "published-ip-manifest",
    source: "https://openai.com/searchbot.json",
  },
  {
    family: "oai-adsbot",
    matcher: /\bOAI-AdsBot\b/i,
    method: "published-ip-manifest",
    source: "https://openai.com/adsbot.json",
  },
  {
    family: "perplexitybot",
    matcher: /\bPerplexityBot\b/i,
    method: "published-ip-manifest",
    source: "https://www.perplexity.com/perplexitybot.json",
  },
  {
    family: "perplexity-user",
    matcher: /\bPerplexity-User\b/i,
    method: "published-ip-manifest",
    source: "https://www.perplexity.com/perplexity-user.json",
  },
  {
    family: "gptbot",
    matcher: /\bGPTBot\b/i,
    method: "none",
  },
  {
    family: "claudebot",
    matcher: /\bClaudeBot\b/i,
    method: "none",
  },
];

function classifyUserAgent(userAgent: string): Policy | null {
  return BOT_VERIFICATION_POLICIES.find((policy) => policy.matcher.test(userAgent)) ?? null;
}

/**
 * Delegate subnet arithmetic to Node's maintained network primitive instead of
 * custom integer math. This works with the repository's TypeScript target and
 * supports both IPv4 and IPv6 without changing compiler/runtime targets.
 */
export function cidrContains(cidr: string, ip: string): boolean {
  const [networkText, prefixText] = cidr.split("/");
  if (!networkText || prefixText === undefined) return false;
  const networkFamily = isIP(networkText);
  const candidateFamily = isIP(ip);
  if (networkFamily === 0 || candidateFamily === 0 || networkFamily !== candidateFamily) return false;

  const prefix = Number(prefixText);
  const maxPrefix = networkFamily === 4 ? 32 : 128;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) return false;

  const type = networkFamily === 4 ? "ipv4" : "ipv6";
  try {
    const blockList = new BlockList();
    blockList.addSubnet(networkText, prefix, type);
    return blockList.check(ip, type);
  } catch {
    return false;
  }
}

export function extractManifestCidrs(manifest: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      const candidate = value.trim();
      if (candidate.includes("/")) {
        const [ip, prefix] = candidate.split("/");
        if (ip && prefix && isIP(ip) !== 0 && /^\d+$/.test(prefix)) found.add(candidate);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  };
  visit(manifest);
  return [...found].sort();
}

export function verifyObservedBot(observation: BotObservation): BotIdentityResult {
  const policy = classifyUserAgent(observation.userAgent);
  if (!policy) {
    return {
      family: "unknown",
      status: "NOT_BOT",
      reason: "No governed crawler user-agent matched.",
      evidenceMethod: "none",
      evidenceSource: null,
    };
  }
  if (isIP(observation.sourceIp) === 0) {
    return {
      family: policy.family,
      status: "UNVERIFIED",
      reason: "Source IP is invalid.",
      evidenceMethod: policy.method,
      evidenceSource: policy.source ?? null,
    };
  }

  if (policy.method === "reverse-forward-dns") {
    const reverse = observation.reverseHostnames ?? [];
    const forward = new Set(observation.forwardResolvedIps ?? []);
    const suffixes = policy.allowedDnsSuffixes ?? [];
    const acceptedHost = reverse.find((hostname) => {
      const normalized = hostname.toLowerCase().replace(/\.$/, "");
      return suffixes.some((suffix) => normalized.endsWith(suffix));
    });
    if (!acceptedHost) {
      return {
        family: policy.family,
        status: "UNVERIFIED",
        reason: "Reverse DNS hostname is outside the provider-owned suffix set.",
        evidenceMethod: policy.method,
        evidenceSource: policy.source ?? null,
      };
    }
    if (!forward.has(observation.sourceIp)) {
      return {
        family: policy.family,
        status: "UNVERIFIED",
        reason: "Forward DNS does not resolve the provider hostname back to the original source IP.",
        evidenceMethod: policy.method,
        evidenceSource: policy.source ?? null,
      };
    }
    return {
      family: policy.family,
      status: "VERIFIED",
      reason: "Reverse DNS provider suffix and forward-confirmation both match.",
      evidenceMethod: policy.method,
      evidenceSource: policy.source ?? null,
    };
  }

  if (policy.method === "published-ip-manifest") {
    if (!policy.source || observation.providerManifestSource !== policy.source) {
      return {
        family: policy.family,
        status: "UNVERIFIED",
        reason: "The supplied IP manifest is not identified as the governed official provider source.",
        evidenceMethod: policy.method,
        evidenceSource: policy.source ?? null,
      };
    }
    const cidrs = extractManifestCidrs(observation.providerManifest);
    if (cidrs.length === 0 || !cidrs.some((cidr) => cidrContains(cidr, observation.sourceIp))) {
      return {
        family: policy.family,
        status: "UNVERIFIED",
        reason: "Source IP is absent from the supplied official provider manifest.",
        evidenceMethod: policy.method,
        evidenceSource: policy.source,
      };
    }
    return {
      family: policy.family,
      status: "VERIFIED",
      reason: "Source IP matches the supplied current official provider manifest.",
      evidenceMethod: policy.method,
      evidenceSource: policy.source,
    };
  }

  return {
    family: policy.family,
    status: "UNVERIFIED",
    reason: "User-agent matched, but no independently verified provider identity method is configured; UA alone is never trusted.",
    evidenceMethod: "none",
    evidenceSource: null,
  };
}

function main() {
  const observationPath = process.argv[process.argv.indexOf("--observation") + 1];
  if (!process.argv.includes("--observation") || !observationPath) {
    console.log(JSON.stringify({ status: "SKIP_NO_DATA", reason: "No server-log bot observation supplied." }));
    return;
  }
  const observation = JSON.parse(
    readFileSync(resolve(process.cwd(), observationPath), "utf8"),
  ) as BotObservation;
  const result = verifyObservedBot(observation);
  console.log(`SEO_BOT_IDENTITY_RESULT=${JSON.stringify(result)}`);
  process.exitCode = result.status === "UNVERIFIED" ? 1 : 0;
}

if (process.argv[1]?.endsWith("bot-identity.ts")) main();
