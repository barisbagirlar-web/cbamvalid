import { buildBuyerShareMetadata } from "@/lib/verify/public-token-access";
import { resolveShareToken } from "@/lib/verify/share-links";
import { enforcePublicRateLimit } from "@/lib/security/public-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function html(status: number, title: string, body: string) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} | CBAMValid</title><style>body{font-family:Inter,system-ui,sans-serif;background:#f7f8fa;color:#14171c;margin:0}.w{max-width:900px;margin:48px auto;padding:0 24px}.c{background:white;border:1px solid #dfe3e8;border-radius:14px;padding:28px;box-shadow:0 6px 24px rgba(0,0,0,.05)}h1{font-size:30px;margin:0 0 8px}.m{color:#5d6672}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:24px 0}.k{border:1px solid #e2e6ea;border-radius:10px;padding:14px}.k b{display:block;font-size:12px;text-transform:uppercase;color:#68717d;margin-bottom:6px}a.b{display:inline-block;background:#145c47;color:white;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:650}.hash{word-break:break-all;font-family:ui-monospace,monospace;font-size:12px}</style></head><body><main class="w">${body}</main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request, props: { params: Promise<{ token: string }> }) {
  const rate = await enforcePublicRateLimit(request, "share", 30);
  if (!rate.allowed) {
    return new Response("Too Many Requests", { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  const { token } = await props.params;
  const resolved = await resolveShareToken(token, true);
  if (resolved.state === "REVOKED") {
    return html(410, "Share link revoked", `<section class="c"><h1>Share link revoked</h1><p class="m">This recipient link is no longer active. The sealed dossier itself has not been deleted or altered.</p></section>`);
  }
  if (resolved.state !== "ACTIVE") {
    return html(404, "Share link not found", `<section class="c"><h1>Share link not found</h1><p class="m">The link is invalid or no longer available.</p></section>`);
  }

  const meta = buildBuyerShareMetadata(resolved.reportData);
  return html(200, "Sealed dossier share", `<section class="c"><p class="m">CBAMValid sealed dossier · ${escapeHtml(resolved.label)}</p><h1>Integrity-preserving recipient view</h1><p class="m">This page exposes release and integrity metadata only. It is not an accredited verification opinion.</p><div class="g"><div class="k"><b>Release</b>${escapeHtml(meta.releaseVersion)}</div><div class="k"><b>Ruleset</b>${escapeHtml(meta.rulesetVersion)}</div><div class="k"><b>Evidence coverage</b>${escapeHtml(meta.evidenceCoverage)}</div><div class="k"><b>Embedded emissions</b>${escapeHtml(meta.totalEmbeddedEmissions)}</div></div><div class="k"><b>Document SHA-256</b><span class="hash">${escapeHtml(meta.documentHash)}</span></div><p style="margin-top:22px"><a class="b" href="/api/share/${escapeHtml(token)}/download">Download sealed package</a></p><p class="m">Verify authenticity independently at <a href="/verify">cbamvalid.com/verify</a> using the report/package identifier and hash shown in the dossier.</p></section>`);
}
