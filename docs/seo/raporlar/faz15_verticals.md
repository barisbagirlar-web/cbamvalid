# Faz 15 — Vertical Modules

- Active module from config: **SaaS**.
- `/methodology` was converted from a client page to a server-rendered documentation surface without removing visible content.
- Public product/pricing offers remain on `CANONICAL_PRICING` / `PRICE_CLAIM` source-of-truth paths.
- Ecommerce, local, media and i18n are not active in `business.verticals`; their runtime features were not fabricated or published.
- All BLOCK rules for inactive modules still have fail-closed reusable guards and negative fixtures so later activation cannot silently weaken V6.
- Doorway, variant-demand, out-of-stock retirement, NAP, news age, hreflang, x-default, IP-redirect and vertical-rule weakening guards are executable.
- Runtime changed only for `/methodology`; deployment is required after exact-head merge.
