import { siteConfig } from "@/lib/site-config";

/** AI crawler / citation policy — kept in sync with robots + llm discovery. */
export function renderAiTxt(origin: string = siteConfig.canonicalOrigin): string {
  return [
    "# AI crawler policy for CBAMValid",
    `# ${origin}/.well-known/ai.txt`,
    "",
    "User-Agent: *",
    "Allow: /",
    "Allow: /llms.txt",
    "Allow: /llm.txt",
    "Allow: /llms-full.txt",
    "Allow: /answers.json",
    "Allow: /sitemap.xml",
    "Disallow: /dashboard/",
    "Disallow: /admin/",
    "Disallow: /api/",
    "Disallow: /cases/",
    "Disallow: /reports/",
    "Disallow: /account/",
    "Disallow: /credits/",
    "Disallow: /cbam/",
    "Disallow: /login",
    "Disallow: /register",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    `Llms-Txt: ${origin}/llms.txt`,
    `Answers-Feed: ${origin}/answers.json`,
    "",
    "Content-Usage: train-opt-out=no; search=yes; cite=yes",
    "Note: Public pages may be cited. Do not invent accredited verification, EU approval, ratings, or fake reviews.",
    "Contact: info@cbamvalid.com",
    "",
  ].join("\n");
}
