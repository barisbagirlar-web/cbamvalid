import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthProvider";
import { siteConfig } from "@/lib/site-config";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${sourceSerif.variable} ${ibmPlexMono.variable}`}
    >
      <body className={`${sourceSans.className} bg-kil-base text-kil-text antialiased min-h-screen`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
