import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { listSitemapRoutes } from "../../lib/seo/registry";

type LinkEdge = { source: string; target: string; anchor: string };
type Thresholds = { orphanPageWarnPct: number; anchorConcentrationWarnPct: number };
type LinkConfig = { site: { rootUrl: string }; thresholds: Thresholds };

export type LinkEquityResult = {
  siteId: string;
  measuredAt: string;
  baseUrl: string;
  routeCount: number;
  fetchedRouteCount: number;
  orphanDefinition: "internalLinksIn < 2 distinct indexable sources";
  orphanThresholdPct: number;
  orphanCount: number;
  orphanRatioPct: number;
  orphanRoutes: string[];
  anchorMeasurementScope: "contextual links excluding header/nav/footer chrome";
  anchorConcentrationThresholdPct: number;
  anchorWarnings: Array<{ target: string; anchor: string; concentrationPct: number; samples: number }>;
  pageRank: Array<{ path: string; before: number; simulatedAfter: number; delta: number }>;
  missingGovernedEdges: Array<{ source: string; target: string }>;
  simulationOnly: true;
  warnings: string[];
};

const PAGERANK_DAMPING = 0.85;
const PAGERANK_ITERATIONS = 60;
const DEFAULT_PORT = 3187;

function parseArgs(argv: string[]) {
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    site: value("--site") ?? "cbamvalid",
    output: value("--output"),
    dryRun: argv.includes("--dry-run"),
    baseUrl: value("--base-url") ?? process.env.SEO_BASE_URL,
  };
}

function loadConfig(site: string): LinkConfig {
  const path = resolve(process.cwd(), "sites", site, "seo.config.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as LinkConfig;
  for (const [label, value] of Object.entries({
    orphanPageWarnPct: parsed.thresholds?.orphanPageWarnPct,
    anchorConcentrationWarnPct: parsed.thresholds?.anchorConcentrationWarnPct,
  })) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Phase 07 config error: ${label} must be finite`);
    }
  }
  return parsed;
}

function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeAnchor(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Anchor-spam discipline applies to editorial/contextual links, not repeated site chrome.
 * All links still count for inbound/orphan/PageRank; only header/nav/footer blocks are removed
 * from the anchor-concentration sample so legitimate global navigation cannot self-trigger INV-7.3.
 */
export function stripSiteChrome(html: string): string {
  return html.replace(/<(header|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
}

export function extractInternalEdges(
  sourcePath: string,
  html: string,
  baseUrl: string,
  allowedPaths: ReadonlySet<string>,
): LinkEdge[] {
  const origin = new URL(baseUrl).origin;
  const edges: LinkEdge[] = [];
  const seen = new Set<string>();
  const pattern = /<a\b[^>]*\bhref=(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const rawHref = decodeHtml(match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (!rawHref || rawHref.startsWith("#") || /^(?:mailto|tel|javascript):/i.test(rawHref)) continue;
    let targetUrl: URL;
    try {
      targetUrl = new URL(rawHref, `${origin}${sourcePath}`);
    } catch {
      continue;
    }
    if (targetUrl.origin !== origin) continue;
    const target = normalizePath(targetUrl.pathname);
    if (target === sourcePath || !allowedPaths.has(target)) continue;
    const anchor = normalizeAnchor(match[4] ?? "") || "[empty]";
    const key = `${sourcePath}\u0000${target}\u0000${anchor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ source: sourcePath, target, anchor });
  }
  return edges;
}

export function extractContextualInternalEdges(
  sourcePath: string,
  html: string,
  baseUrl: string,
  allowedPaths: ReadonlySet<string>,
): LinkEdge[] {
  return extractInternalEdges(sourcePath, stripSiteChrome(html), baseUrl, allowedPaths);
}

export function computePageRank(
  paths: readonly string[],
  edges: readonly Pick<LinkEdge, "source" | "target">[],
  damping = PAGERANK_DAMPING,
  iterations = PAGERANK_ITERATIONS,
): Map<string, number> {
  const nodes = [...new Set(paths)];
  const n = nodes.length;
  if (n === 0) return new Map();
  const allowed = new Set(nodes);
  const outgoing = new Map(nodes.map((path) => [path, new Set<string>()]));
  for (const edge of edges) {
    if (allowed.has(edge.source) && allowed.has(edge.target) && edge.source !== edge.target) {
      outgoing.get(edge.source)?.add(edge.target);
    }
  }
  let ranks = new Map(nodes.map((path) => [path, 1 / n]));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Map(nodes.map((path) => [path, (1 - damping) / n]));
    let dangling = 0;
    for (const source of nodes) {
      const targets = outgoing.get(source) ?? new Set<string>();
      const rank = ranks.get(source) ?? 0;
      if (targets.size === 0) {
        dangling += rank;
        continue;
      }
      const share = (damping * rank) / targets.size;
      for (const target of targets) next.set(target, (next.get(target) ?? 0) + share);
    }
    const danglingShare = (damping * dangling) / n;
    for (const path of nodes) next.set(path, (next.get(path) ?? 0) + danglingShare);
    ranks = next;
  }
  return ranks;
}

export function evaluateLinkGraph(params: {
  siteId: string;
  baseUrl: string;
  paths: readonly string[];
  edges: readonly LinkEdge[];
  anchorEdges?: readonly LinkEdge[];
  intendedEdges?: readonly { source: string; target: string }[];
  thresholds: Thresholds;
  measuredAt?: string;
}): LinkEquityResult {
  const paths = [...new Set(params.paths.map(normalizePath))].sort();
  const allowed = new Set(paths);
  const distinctInboundSources = new Map(paths.map((path) => [path, new Set<string>()]));
  const actualPairs = new Set<string>();

  for (const edge of params.edges) {
    if (!allowed.has(edge.source) || !allowed.has(edge.target)) continue;
    distinctInboundSources.get(edge.target)?.add(edge.source);
    actualPairs.add(`${edge.source}\u0000${edge.target}`);
  }

  const orphanRoutes = paths.filter((path) => (distinctInboundSources.get(path)?.size ?? 0) < 2);
  const orphanRatioPct = paths.length === 0 ? 0 : (orphanRoutes.length / paths.length) * 100;

  const anchorCounts = new Map<string, Map<string, number>>();
  for (const edge of params.anchorEdges ?? params.edges) {
    if (!allowed.has(edge.source) || !allowed.has(edge.target)) continue;
    const counts = anchorCounts.get(edge.target) ?? new Map<string, number>();
    counts.set(edge.anchor, (counts.get(edge.anchor) ?? 0) + 1);
    anchorCounts.set(edge.target, counts);
  }

  const anchorWarnings: LinkEquityResult["anchorWarnings"] = [];
  for (const [target, counts] of anchorCounts) {
    const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
    if (total === 0) continue;
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!top) continue;
    const concentrationPct = (top[1] / total) * 100;
    if (concentrationPct > params.thresholds.anchorConcentrationWarnPct) {
      anchorWarnings.push({ target, anchor: top[0], concentrationPct, samples: total });
    }
  }
  anchorWarnings.sort((a, b) => b.concentrationPct - a.concentrationPct || a.target.localeCompare(b.target));

  const intended = (params.intendedEdges ?? []).filter(
    (edge) => allowed.has(edge.source) && allowed.has(edge.target) && edge.source !== edge.target,
  );
  const missingGovernedEdges = intended
    .filter((edge) => !actualPairs.has(`${edge.source}\u0000${edge.target}`))
    .filter(
      (edge, index, all) =>
        all.findIndex((candidate) => candidate.source === edge.source && candidate.target === edge.target) === index,
    )
    .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));

  const before = computePageRank(paths, params.edges);
  const simulatedEdges = [
    ...params.edges,
    ...missingGovernedEdges.map((edge) => ({ ...edge, anchor: "[governed-simulation]" })),
  ];
  const after = computePageRank(paths, simulatedEdges);
  const pageRank = paths
    .map((path) => ({
      path,
      before: before.get(path) ?? 0,
      simulatedAfter: after.get(path) ?? 0,
      delta: (after.get(path) ?? 0) - (before.get(path) ?? 0),
    }))
    .sort((a, b) => b.before - a.before || a.path.localeCompare(b.path));

  const warnings: string[] = [];
  if (orphanRatioPct > params.thresholds.orphanPageWarnPct) {
    warnings.push(
      `INV-7.1 orphan ratio ${orphanRatioPct.toFixed(2)}% exceeds ${params.thresholds.orphanPageWarnPct}%`,
    );
  }
  if (anchorWarnings.length > 0) {
    warnings.push(`INV-7.3 ${anchorWarnings.length} target(s) exceed contextual anchor concentration threshold`);
  }

  return {
    siteId: params.siteId,
    measuredAt: params.measuredAt ?? new Date().toISOString(),
    baseUrl: params.baseUrl,
    routeCount: paths.length,
    fetchedRouteCount: paths.length,
    orphanDefinition: "internalLinksIn < 2 distinct indexable sources",
    orphanThresholdPct: params.thresholds.orphanPageWarnPct,
    orphanCount: orphanRoutes.length,
    orphanRatioPct,
    orphanRoutes,
    anchorMeasurementScope: "contextual links excluding header/nav/footer chrome",
    anchorConcentrationThresholdPct: params.thresholds.anchorConcentrationWarnPct,
    anchorWarnings,
    pageRank,
    missingGovernedEdges,
    simulationOnly: true,
    warnings,
  };
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolvePromise() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

async function waitForServer(baseUrl: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(baseUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status >= 200 && response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Phase 07 local server did not become ready: ${String(lastError ?? "timeout")}`);
}

function startServer(port: number): ChildProcess {
  const nextCli = resolve(process.cwd(), "node_modules/next/dist/bin/next");
  return spawn(process.execPath, [nextCli, "start", "-p", String(port), "-H", "127.0.0.1"], {
    stdio: "ignore",
    env: { ...process.env, PORT: String(port) },
  });
}

async function fetchEdges(
  baseUrl: string,
  paths: readonly string[],
): Promise<{ allEdges: LinkEdge[]; contextualEdges: LinkEdge[] }> {
  const allowed = new Set(paths.map(normalizePath));
  const allEdges: LinkEdge[] = [];
  const contextualEdges: LinkEdge[] = [];
  const batches: string[][] = [];
  for (let index = 0; index < paths.length; index += 8) batches.push(paths.slice(index, index + 8));
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(async (path) => {
        const response = await fetch(new URL(path, baseUrl), {
          redirect: "manual",
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) throw new Error(`Phase 07 crawl failed ${path}: HTTP ${response.status}`);
        const html = await response.text();
        return {
          all: extractInternalEdges(path, html, baseUrl, allowed),
          contextual: extractContextualInternalEdges(path, html, baseUrl, allowed),
        };
      }),
    );
    for (const result of results) {
      allEdges.push(...result.all);
      contextualEdges.push(...result.contextual);
    }
  }
  return { allEdges, contextualEdges };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.site);
  const routes = listSitemapRoutes();
  const paths = routes.map((route) => normalizePath(route.canonicalPath));
  const intendedEdges = routes.flatMap((route) =>
    route.internalLinkTargets.map((target) => ({
      source: normalizePath(route.canonicalPath),
      target: normalizePath(target),
    })),
  );

  let server: ChildProcess | undefined;
  const baseUrl = args.baseUrl ?? `http://127.0.0.1:${DEFAULT_PORT}`;
  try {
    if (!args.baseUrl) {
      if (process.env.SEO_SKIP_BUILD !== "1") await runCommand("npm", ["run", "build"]);
      server = startServer(DEFAULT_PORT);
      await waitForServer(baseUrl);
    }
    const { allEdges, contextualEdges } = await fetchEdges(baseUrl, paths);
    const result = evaluateLinkGraph({
      siteId: args.site,
      baseUrl: config.site.rootUrl,
      paths,
      edges: allEdges,
      anchorEdges: contextualEdges,
      intendedEdges,
      thresholds: config.thresholds,
    });
    result.fetchedRouteCount = paths.length;
    const json = JSON.stringify(result, null, 2);
    console.log(`SEO_LINK_EQUITY_RESULT=${JSON.stringify(result)}`);
    if (args.output && !args.dryRun) {
      const outputPath = resolve(process.cwd(), args.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${json}\n`, "utf8");
    }
    process.exitCode = result.warnings.length > 0 ? 2 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  } finally {
    if (server && !server.killed) server.kill("SIGTERM");
  }
}

if (process.argv[1]?.endsWith("link-equity.ts")) {
  void main();
}
