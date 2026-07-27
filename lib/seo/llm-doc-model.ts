import {
  INDEPENDENCE_CLAIM,
  PRICE_CLAIM,
  PRODUCT_POSITIONING_CLAIM,
  SUPPORT_EMAIL_CLAIM,
  assertVerifiedClaim,
} from "./claims";
import { AEO_ANSWER_BANK } from "./aeo/answer-bank";
import { AUTHORITY_CHAINS } from "./aeo/authority-chains";
import { TOPICAL_MAP } from "./aeo/topical-map";
import { listVerifiedRegulatoryStatements, SEO_LEGAL_SOURCE_INDEX } from "./regulatory-sources";
import { listSitemapRoutes } from "./registry";
import { siteConfig } from "@/lib/site-config";

export interface LlmDocModel {
  readonly title: string;
  readonly summary: string;
  readonly productPositioning: string;
  readonly independence: string;
  readonly pricingLine: string;
  readonly paymentFlow: string;
  readonly supportEmail: string;
  readonly resources: readonly { readonly title: string; readonly url: string; readonly note: string }[];
  readonly topicalMap: readonly {
    readonly path: string;
    readonly topic: string;
    readonly covers: readonly string[];
    readonly entities: readonly string[];
    readonly fanOutQueries: readonly string[];
  }[];
  readonly answers: readonly { readonly question: string; readonly answer: string; readonly routes: readonly string[] }[];
  readonly authorityChains: readonly {
    readonly path: string;
    readonly primaryQuestion: string;
    readonly directAnswer: string;
    readonly empathyLead: string;
    readonly calculation: string;
    readonly explanation: string;
    readonly methodology: string;
    readonly evidence: string;
    readonly expert: string;
    readonly relatedPaths: readonly string[];
    readonly entities: readonly string[];
    readonly fanOutQueries: readonly string[];
  }[];
  readonly regulatoryStatements: readonly string[];
  readonly legalSources: readonly { readonly id: string; readonly title: string; readonly url: string }[];
  readonly lastUpdated: string;
}

export function buildLlmDocModel(): LlmDocModel {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  const resources = listSitemapRoutes()
    .filter((route) => route.pageType !== "legal" && route.pageType !== "cn-detail")
    .slice(0, 24)
    .map((route) => ({
      title: route.h1,
      url: `${siteConfig.canonicalOrigin}${route.canonicalPath === "/" ? "" : route.canonicalPath}`,
      note: route.primaryIntent,
    }));

  return {
    title: "CBAMValid — Exporter Verification Preparation Pack",
    summary:
      "CBAMValid (https://cbamvalid.com) is a verifier-preparation platform for non-EU producers, exporters, operators, importers, and CBAM reporting teams. It produces an operator-prepared dossier that reduces the work required for independent accredited verification. It does not issue an accredited verification opinion.",
    productPositioning: assertVerifiedClaim(PRODUCT_POSITIONING_CLAIM, "PRODUCT_POSITIONING_CLAIM"),
    independence: assertVerifiedClaim(INDEPENDENCE_CLAIM, "INDEPENDENCE_CLAIM"),
    pricingLine: `${price.formatted} per working file at lock (${price.packName}; one-time; no subscription; drafts free; 1 operator; 1 installation; 1 reporting year; same-file corrections included; new file = new payment).`,
    paymentFlow:
      "Draft free in a working file (eight plain steps). Clear blockers. Pay once to lock that file. Correct and re-lock the same paid file as needed. Failed locks charge nothing. Re-download is free. A new working file needs a new payment.",
    supportEmail: assertVerifiedClaim(SUPPORT_EMAIL_CLAIM, "SUPPORT_EMAIL_CLAIM"),
    resources,
    topicalMap: TOPICAL_MAP.map((node) => ({
      path: node.path,
      topic: node.topic,
      covers: node.covers,
      entities: node.entities,
      fanOutQueries: node.fanOutQueries,
    })),
    answers: AEO_ANSWER_BANK.map((answer) => ({
      question: answer.question,
      answer: `${answer.directAnswer} ${answer.empathyContext}`,
      routes: answer.routes,
    })),
    authorityChains: AUTHORITY_CHAINS.map((chain) => ({
      path: chain.path,
      primaryQuestion: chain.primaryQuestion,
      directAnswer: chain.directAnswer,
      empathyLead: chain.empathyLead,
      calculation: chain.calculation,
      explanation: chain.explanation,
      methodology: chain.methodology,
      evidence: chain.evidence,
      expert: chain.expert,
      relatedPaths: chain.relatedProblems.map((item) => item.href),
      entities: chain.entities,
      fanOutQueries: chain.fanOutQueries,
    })),
    regulatoryStatements: listVerifiedRegulatoryStatements(),
    legalSources: Object.values(SEO_LEGAL_SOURCE_INDEX).map((source) => ({
      id: source.id,
      title: source.title,
      url: source.eliUri,
    })),
    lastUpdated: "2026-07-27",
  };
}

export function renderLlmsTxt(model: LlmDocModel): string {
  const lines: string[] = [
    `# ${model.title}`,
    "",
    `> ${model.summary}`,
    "",
    "## Product positioning",
    "",
    `- ${model.productPositioning}`,
    `- Pricing: ${model.pricingLine}`,
    `- Payment flow: ${model.paymentFlow}`,
    "",
    "## Independence boundary",
    "",
    model.independence,
    "",
    "## Canonical answers (Answer + Evidence)",
    "",
  ];

  for (const answer of model.answers) {
    lines.push(`- Q: ${answer.question}`);
    lines.push(`  A: ${answer.answer}`);
    lines.push(`  Pages: ${answer.routes.join(", ")}`);
  }

  lines.push(
    "",
    "## Authority chains (Direct Answer → Calculation → Explanation → Methodology → Evidence → Expert → Related)",
    "",
  );
  for (const chain of model.authorityChains) {
    lines.push(`### ${chain.path}`);
    lines.push(`- Primary question: ${chain.primaryQuestion}`);
    lines.push(`- Empathy: ${chain.empathyLead}`);
    lines.push(`- Direct answer: ${chain.directAnswer}`);
    lines.push(`- Calculation: ${chain.calculation}`);
    lines.push(`- Explanation: ${chain.explanation}`);
    lines.push(`- Methodology: ${chain.methodology}`);
    lines.push(`- Evidence: ${chain.evidence}`);
    lines.push(`- Expert: ${chain.expert}`);
    lines.push(`- Related: ${chain.relatedPaths.join(", ")}`);
    lines.push(`- Entities: ${chain.entities.join("; ")}`);
    lines.push(`- Fan-out queries: ${chain.fanOutQueries.join("; ")}`);
    lines.push("");
  }

  lines.push("## Topical map (topic → entities → fan-out → links)", "");
  for (const node of model.topicalMap) {
    lines.push(`- ${node.path} — ${node.topic}`);
    lines.push(`  Covers: ${node.covers.join("; ")}`);
    if (node.entities.length > 0) lines.push(`  Entities: ${node.entities.join("; ")}`);
    if (node.fanOutQueries.length > 0) lines.push(`  Fan-out: ${node.fanOutQueries.join("; ")}`);
  }

  lines.push("", "## Core public resources", "");

  for (const resource of model.resources) {
    lines.push(`- [${resource.title}](${resource.url}): ${resource.note}`);
  }

  lines.push("", "## Key regulatory facts", "");
  for (const statement of model.regulatoryStatements) {
    lines.push(`- ${statement}`);
  }

  lines.push("", "## Authoritative source families", "");
  for (const source of model.legalSources) {
    lines.push(`- ${source.id}: [${source.title}](${source.url})`);
  }

  lines.push(
    "",
    "## Machine-readable feeds",
    "",
    `- Answers JSON-LD feed: ${siteConfig.canonicalOrigin}/answers.json`,
    `- Answers RSS feed: ${siteConfig.canonicalOrigin}/answers.rss`,
    `- LLM index: ${siteConfig.canonicalOrigin}/llms.txt`,
    `- LLM full index: ${siteConfig.canonicalOrigin}/llms-full.txt`,
    `- AI crawler policy: ${siteConfig.canonicalOrigin}/.well-known/ai.txt`,
    "",
    "## Contact",
    "",
    `- Website: ${siteConfig.canonicalOrigin}`,
    `- Support: ${model.supportEmail}`,
    "",
    `Last updated: ${model.lastUpdated}`,
    "",
  );

  return lines.join("\n");
}

export function renderLlmsFullTxt(model: LlmDocModel): string {
  return [
    renderLlmsTxt(model).trimEnd(),
    "",
    "## Explicit non-claims",
    "",
    "- Not an accredited verification opinion",
    "- Not an official European Commission or CBAM Registry service",
    "- Not customs approval or registry acceptance",
    "- No synthetic customer counts, ratings, or testimonials",
    "- No fabricated Review / AggregateRating schema nodes",
    "- One pack is not reusable across another installation or reporting year",
    "- Academic mathematical review is not accredited CBAM verification",
    "",
  ].join("\n");
}
