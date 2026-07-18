/**
 * PHASE 4 §3: embed.js — CBAMValid Widget Embed Script
 *
 * Protocol: Third-party logistics/customs/freight platforms include this
 * single script tag on their site to embed the CBAM calculator widget.
 * The widget enforces a dofollow canonical backlink for link equity.
 *
 * Usage:
 *   <script src="https://cbamvalid.com/embed.js" async></script>
 *
 * INV-09: All embeds must include rel="dofollow" link to cbamvalid.com.
 * The ?ref=widget-embed parameter isolates widget traffic in GSC.
 */

(function () {
  "use strict";

  // Prevent double injection
  if (document.getElementById("cbamvalid-widget-container")) return;

  var container = document.createElement("div");
  container.id = "cbamvalid-widget-container";
  container.style.cssText =
    "max-width:640px;margin:24px auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;font-family:system-ui,-apple-system,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.08)";

  container.innerHTML =
    '<iframe ' +
    'src="https://cbamvalid.com/widget/cbam-calculator" ' +
    'width="100%" ' +
    'height="620px" ' +
    'frameborder="0" ' +
    'loading="lazy" ' +
    'title="CBAM Emissions Calculator Widget" ' +
    'sandbox="allow-scripts allow-same-origin allow-forms allow-popups" ' +
    'style="display:block;border:none;background:#fff">' +
    "</iframe>" +
    '<div style="text-align:center;padding:10px 16px;font-size:12px;color:#6b7280;background:#f9fafb;border-top:1px solid #e5e7eb;font-family:system-ui,-apple-system,sans-serif">' +
    'Powered by <a href="https://cbamvalid.com?ref=widget-embed" target="_blank" rel="dofollow" style="color:#2563eb;text-decoration:none;font-weight:600">CBAMValid Compliance Engine</a> &mdash; EU CBAM Emissions Calculator' +
    "</div>";

  // Insert after the script tag
  var script = document.currentScript;
  if (script && script.parentNode) {
    script.parentNode.insertBefore(container, script);
  } else {
    // Fallback: append to body
    document.body.appendChild(container);
  }
})();
