import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Lora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AnalyticsBeacon } from "@/components/seo/AnalyticsProvider";
import { siteConfig } from "@/lib/site-config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  preload: false,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} bg-kil-base text-kil-text antialiased min-h-screen`}>
        {/* AuthProvider intentionally NOT on public marketing routes — Firebase client
            was the primary LCP/main-thread tax on anonymous homepage visits. Mounted
            only under (auth) and (workspace) layouts. */}
        <Suspense fallback={null}>
          <AnalyticsBeacon />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
