import { PublicHeader } from "@/components/layout/PublicHeader";
import AppFooter from "@/components/layout/AppFooter";
import { AnalyticsConsentManager } from "@/components/marketing/AnalyticsConsentManager";
import { ConsentModeBootstrap } from "@/components/marketing/ConsentModeBootstrap";
import { siteConfig } from "@/lib/site-config";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ConsentModeBootstrap />
      {/* Manual public stylesheet is intentional for Firebase Hosting static CSS parity. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/assets/css/style.css" />
      {/* Machine-readable discovery for LLM / answer engines (also in metadata alternates). */}
      <link rel="alternate" type="text/plain" href={`${siteConfig.canonicalOrigin}/llms.txt`} title="LLM index" />
      <link
        rel="alternate"
        type="application/ld+json"
        href={`${siteConfig.canonicalOrigin}/answers.json`}
        title="Answer authority feed"
      />
      <link
        rel="alternate"
        type="application/rss+xml"
        href={`${siteConfig.canonicalOrigin}/answers.rss`}
        title="CBAMValid answers feed"
      />
      <link
        rel="alternate"
        type="application/feed+json"
        href={`${siteConfig.canonicalOrigin}/answers.feed.json`}
        title="CBAMValid JSON Feed"
      />
      <link rel="author" href={`${siteConfig.canonicalOrigin}/about`} />
      <PublicHeader />
      {children}
      <AppFooter />
      <AnalyticsConsentManager />
    </>
  );
}
