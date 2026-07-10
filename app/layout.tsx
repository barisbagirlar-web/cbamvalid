import type { Metadata } from "next";
import { Inter, Lora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";

// Sans: Gövde Metinleri
const inter = Inter({ 
  subsets: ["latin"], 
  variable: '--font-inter' 
});

// Serif: Başlıklar ve Otorite gerektiren alanlar
const lora = Lora({ 
  subsets: ["latin"], 
  variable: '--font-lora' 
});

// Mono: Finansal Rakamlar ve Girdiler
const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"], 
  variable: '--font-jetbrains-mono' 
});

export const metadata: Metadata = {
  title: "CBAM Türkiye | Karbon Beyannamesi Oluşturucu",
  description: "AB standartlarında anında CBAM XML ve PDF raporu üretin.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" }
    ]
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // HTML'e bg-kil-base ekleyerek tüm sitenin zeminini toprak rengi yapıyoruz
    <html lang="en" className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} bg-kil-base text-kil-text antialiased min-h-screen`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
