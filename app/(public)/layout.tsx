import { PublicHeader } from "@/components/layout/PublicHeader";
import AppFooter from "@/components/layout/AppFooter";
import Script from "next/script";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,560;0,600;1,500;1,560&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/assets/css/style.css" />
      <PublicHeader />
      {children}
      <AppFooter />
      <Script src="/assets/js/main.js" strategy="afterInteractive" />
    </>
  );
}
