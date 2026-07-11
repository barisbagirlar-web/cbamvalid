import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// Geçerli CBAM Fasılları (Security Gate)
const VALID_CHAPTERS = ["72", "73", "76", "25", "27", "28", "31"];

interface PageProps {
  params: Promise<{ code: string }>;
}

// 1. DİNAMİK METADATA & SEMANTİK SEO (AI CRAWLER DOSTU)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const chapter = code.substring(0, 2);
  
  if (code.length !== 8 || !VALID_CHAPTERS.includes(chapter)) {
    return { title: "Invalid CN Code | CBAM Valid" };
  }

  return {
    title: `CBAM Declaration for CN Code ${code} | EU Compliance`,
    description: `Generate CBAMValid Exporter Evidence XML and PDF documents for CN Code ${code}. Calculate direct and precursor embedded emissions accurately.`,
    alternates: {
      canonical: `https://cbamvalid.com/cn-code/${code}`,
    },
  };
}

// 2. SUNUCU TARAFLI SAYFA ÜRETİMİ (SERVER COMPONENT)
export default async function CNCodeLandingPage({ params }: PageProps) {
  const { code } = await params;
  const chapter = code.substring(0, 2);

  // Kapsam dışı kod girilirse 404 sayfasına at (Çöp indekslemeyi önler)
  if (code.length !== 8 || !VALID_CHAPTERS.includes(chapter)) {
    notFound();
  }

  // AI botları için JSON-LD Yapılandırılmış Veri (Structured Data)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": `CBAM Calculator for ${code}`,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "150.00",
      "priceCurrency": "USD"
    },
    "description": `Automated CBAM compliance tool for goods under CN code ${code}.`,
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* JSON-LD ENJEKSİYONU */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* MİNİMALİST SEO VİTRİNİ */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 inline-flex items-center space-x-2 border border-border bg-surface px-4 py-1.5 rounded-full text-xs font-mono tracking-widest uppercase text-accent font-semibold">
            <span>Chapter {chapter} Compliant</span>
          </div>
          
          <h1 className="font-serif text-4xl md:text-6xl font-normal tracking-tight text-foreground leading-tight mb-6">
            EU CBAM Declaration for <br />
            <span className="font-mono text-accent">{code}</span>
          </h1>
          
          <p className="text-lg text-muted mb-12 leading-relaxed">
            Exporting products under CN Code {code} to the European Union? Calculate your embedded direct, indirect, and precursor emissions. Generate your CBAMValid Exporter Evidence XML package in minutes.
          </p>
          
          <Link 
            href={`/dashboard/wizard?cn=${code}`} 
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-8 py-4 text-base font-medium text-surface transition-colors hover:bg-accent-hover active:bg-accent-active shadow-sm"
          >
            Start Wizard for {code}
          </Link>
        </div>
      </main>
    </div>
  );
}
