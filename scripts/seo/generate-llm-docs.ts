import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { buildLlmDocModel, renderLlmsFullTxt, renderLlmsTxt } from "../../lib/seo/llm-doc-model";
import { renderAiTxt } from "../../lib/seo/ai-txt";
import { siteConfig } from "../../lib/site-config";

const DISALLOW_PRIVATE = [
  "/dashboard/",
  "/admin/",
  "/api/",
  "/cases/",
  "/reports/",
  "/account/",
  "/credits/",
  "/cbam/",
  "/login",
  "/register",
] as const;

/**
 * Must stay aligned with app/robots.ts.
 * Static public/robots.txt is required for Firebase Hosting reliability:
 * the frameworks Cloud Run adapter has returned empty 404 for /robots.txt
 * even when app/robots.ts prerenders successfully in the Next build.
 */
export function renderRobotsTxt(origin: string = siteConfig.canonicalOrigin): string {
  const lines: string[] = [];

  const emitAgent = (userAgent: string, withDisallow: boolean) => {
    lines.push(`User-Agent: ${userAgent}`);
    lines.push("Allow: /");
    if (withDisallow) {
      for (const path of DISALLOW_PRIVATE) {
        lines.push(`Disallow: ${path}`);
      }
    }
    lines.push("");
  };

  emitAgent("*", true);
  emitAgent("OAI-SearchBot", true);
  emitAgent("Googlebot", true);
  emitAgent("GPTBot", false);
  emitAgent("ClaudeBot", false);
  emitAgent("Google-Extended", false);

  lines.push(`Sitemap: ${origin}/sitemap.xml`);
  lines.push(`Host: ${origin}`);
  lines.push("");
  return lines.join("\n");
}

const root = resolve(process.cwd());
const model = buildLlmDocModel();
const llms = renderLlmsTxt(model);
const full = renderLlmsFullTxt(model);
const robots = renderRobotsTxt();

writeFileSync(resolve(root, "public/llms.txt"), llms, "utf8");
writeFileSync(resolve(root, "public/llm.txt"), llms, "utf8");
writeFileSync(resolve(root, "public/llms-full.txt"), full, "utf8");
writeFileSync(resolve(root, "public/robots.txt"), robots, "utf8");

const wellKnownDir = resolve(root, "public/.well-known");
mkdirSync(wellKnownDir, { recursive: true });
writeFileSync(resolve(wellKnownDir, "ai.txt"), renderAiTxt(), "utf8");
writeFileSync(resolve(root, "public/ai-policy.txt"), renderAiTxt(), "utf8");

console.log(
  "Generated public/llms.txt, public/llm.txt, public/llms-full.txt, public/robots.txt, public/.well-known/ai.txt, public/ai-policy.txt from SEO SSOT",
);
