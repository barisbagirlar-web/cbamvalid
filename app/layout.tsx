import type { Metadata } from "next";
import { Inter, Lora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthProvider";
import { siteConfig } from "@/lib/site-config";

// Sans: Body text
const inter = Inter({ 
  subsets: ["latin"], 
  variable: '--font-inter' 
});

// Serif: Headings and authority areas
const lora = Lora({ 
  subsets: ["latin"], 
  variable: '--font-lora' 
});

// Mono: Financial data and inputs
const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"], 
  variable: '--font-jetbrains-mono' 
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.canonicalOrigin),
  title: {
    template: siteConfig.titleTemplate,
    default: siteConfig.defaultTitle,
  },
  description: siteConfig.defaultDescription,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" }
    ]
  },
  openGraph: {
    images: ["/og.jpg"],
  },
  verification: {
    google: "OR4qV6cIsxrAyqd6NZBv4kOsQ3F5bJl79yDrxZW4iII"
  }
};

import { buildEntityGraph } from "@/lib/seo/entity-graph";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} bg-kil-base text-kil-text antialiased min-h-screen`}>
        <AuthProvider>
          {children}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildEntityGraph("en")),
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
