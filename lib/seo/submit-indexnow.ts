import { listSitemapRoutes } from "./registry";
import { siteConfig } from "@/lib/site-config";
import { INDEXNOW_ENDPOINTS, INDEXNOW_KEY, INDEXNOW_KEY_PATH } from "./indexnow";

/**
 * Notify IndexNow-compatible engines that sitemap URLs changed.
 * Fail-open: network errors are logged; never blocks builds.
 */
export async function submitIndexNow(urls?: readonly string[]): Promise<{
  submitted: number;
  results: { endpoint: string; ok: boolean; status?: number; detail: string }[];
}> {
  const host = new URL(siteConfig.canonicalOrigin).host;
  const urlList =
    urls && urls.length > 0
      ? [...urls]
      : listSitemapRoutes().map((route) =>
          route.canonicalPath === "/"
            ? siteConfig.canonicalOrigin
            : `${siteConfig.canonicalOrigin}${route.canonicalPath}`,
        );

  // Always include discovery surfaces with content updates.
  const extras = [
    `${siteConfig.canonicalOrigin}/llms.txt`,
    `${siteConfig.canonicalOrigin}/answers.json`,
    `${siteConfig.canonicalOrigin}/answers.rss`,
    `${siteConfig.canonicalOrigin}/.well-known/ai.txt`,
  ];
  const unique = Array.from(new Set([...urlList, ...extras]));

  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${siteConfig.canonicalOrigin}${INDEXNOW_KEY_PATH}`,
    urlList: unique,
  };

  const results: { endpoint: string; ok: boolean; status?: number; detail: string }[] = [];

  for (const endpoint of INDEXNOW_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      results.push({
        endpoint,
        ok: response.ok || response.status === 202,
        status: response.status,
        detail: response.ok || response.status === 202 ? "accepted" : await response.text().then((t) => t.slice(0, 200)),
      });
    } catch (error) {
      results.push({
        endpoint,
        ok: false,
        detail: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return { submitted: unique.length, results };
}
