import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import "./step8-premium-actions.css";
import "./step8-footer-hotfix.css";
import { AnalyticsBeacon } from "@/components/seo/AnalyticsProvider";
import { siteConfig } from "@/lib/site-config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.canonicalOrigin),
  title: {
    template: siteConfig.titleTemplate,
    default: siteConfig.defaultTitle,
  },
  description: siteConfig.defaultDescription,
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    images: ["/og.jpg"],
  },
  verification: {
    google: "OR4qV6cIsxrAyqd6NZBv4kOsQ3F5bJl79yDrxZW4iII",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Request-time render so proxy.ts CSP nonces apply to framework scripts.
  await headers();

  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} bg-kil-base text-kil-text antialiased min-h-screen`}>
        {/* AuthProvider intentionally NOT on public marketing routes — Firebase client
            was the primary LCP/main-thread tax on anonymous homepage visits. Mounted
            only under (auth) and (workspace) layouts.
            Serif/mono use system stacks (see globals.css) to avoid competing webfont LCP delay. */}
        <Suspense fallback={null}>
          <AnalyticsBeacon />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
