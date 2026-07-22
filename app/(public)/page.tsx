"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Calculator, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Briefcase, 
  ArrowRight, 
  Info,
  Layers,
  Heart
} from "lucide-react";

interface CalculatorItem {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  category: "valuation" | "analysis" | "investment" | "tax";
  href: string;
  isPilot: boolean;
}

const CALCULATORS: CalculatorItem[] = [
  {
    id: "company-valuation",
    name: "Şirket Değeri Hesaplama",
    nameEn: "Company Valuation Calculator",
    description: "DCF (İndirgenmiş Nakit Akımı) ve EBITDA Çarpanı yöntemlerini bir arada kullanarak şirketinizin Equity Value değerini saniyeler içinde belirleyin.",
    category: "valuation",
    href: "/calculators/company-valuation",
    isPilot: true
  },
  {
    id: "dcf-valuation",
    name: "İndirgenmiş Nakit Akımları (DCF)",
    nameEn: "Discounted Cash Flow Model",
    description: "Gelecek yılların FCF projeksiyonlarını WACC (Ağırlıklı Ortalama Sermaye Maliyeti) ile indirgeyerek Enterprise Value hesaplayın.",
    category: "valuation",
    href: "#",
    isPilot: false
  },
  {
    id: "ebitda-multiple",
    name: "EBITDA Çarpanı Değerlemesi",
    nameEn: "EBITDA Multiple Valuation",
    description: "Şirketinizin sektör ortalaması EV/EBITDA çarpanlarına göre piyasa değerlemesini yapın.",
    category: "valuation",
    href: "#",
    isPilot: false
  },
  {
    id: "dupont-analysis",
    name: "Dupont Analizi",
    nameEn: "Dupont Analysis",
    description: "Özkaynak Karlılığını (ROE) Net Kar Marjı, Varlık Devir Hızı ve Finansal Kaldıraç bileşenlerine ayırarak analiz edin.",
    category: "analysis",
    href: "#",
    isPilot: false
  },
  {
    id: "wacc-calc",
    name: "WACC Sermaye Maliyeti",
    nameEn: "WACC Calculator",
    description: "Borç ve özkaynak maliyetlerini ağırlıklandırarak şirketinizin ağırlıklı ortalama sermaye maliyetini hesaplayın.",
    category: "analysis",
    href: "#",
    isPilot: false
  },
  {
    id: "cash-cycle",
    name: "Nakit Dönüşüm Süresi",
    nameEn: "Cash Conversion Cycle",
    description: "Stokta Kalma Süresi, Tahsilat Süresi ve Ödeme Süresi verilerinden işletme sermayesi döngüsünü hesaplayın.",
    category: "analysis",
    href: "#",
    isPilot: false
  },
  {
    id: "npv-irr",
    name: "NPV & IRR Yatırım Analizi",
    nameEn: "NPV & IRR Investment Analysis",
    description: "Sermaye bütçelemesi projelerinizin Net Bugünkü Değer (NPV) ve İç Verim Oranı (IRR) metriklerini hesaplayın.",
    category: "investment",
    href: "#",
    isPilot: false
  },
  {
    id: "break-even",
    name: "Başabaş Noktası Analizi",
    nameEn: "Break-even Point Analysis",
    description: "Sabit ve değişken maliyetlere göre kâra geçmek için yapılması gereken minimum satış miktarını ve tutarını bulun.",
    category: "investment",
    href: "#",
    isPilot: false
  },
  {
    id: "roi-calc",
    name: "Yatırımın Geri Dönüşü (ROI)",
    nameEn: "Return on Investment",
    description: "Finansal veya operasyonel yatırımların getiri oranını ve net karlılık çarpanını hesaplayın.",
    category: "investment",
    href: "#",
    isPilot: false
  },
  {
    id: "corporate-tax",
    name: "Kurumlar Vergisi Hesaplama",
    nameEn: "Corporate Income Tax",
    description: "Dönem net karı, kanunen kabul edilmeyen giderler ve istisnalara göre ödenecek kurumlar vergisini hesaplayın.",
    category: "tax",
    href: "#",
    isPilot: false
  },
  {
    id: "depreciation",
    name: "Amortisman Hesaplama",
    nameEn: "Depreciation Calculator",
    description: "Maddi duran varlıklar için normal ve azalan bakiyeler yöntemlerine göre amortisman tabloları oluşturun.",
    category: "tax",
    href: "#",
    isPilot: false
  },
  {
    id: "vat-withholding",
    name: "KDV Tevkifatı Hesaplama",
    nameEn: "VAT Withholding Calculator",
    description: "Hizmet ve teslim türlerine göre KDV tevkifatı oranlarını uygulayarak net fatura tutarlarını hesaplayın.",
    category: "tax",
    href: "#",
    isPilot: false
  }
];

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "valuation" | "analysis" | "investment" | "tax">("all");

  const filteredCalculators = useMemo(() => {
    return CALCULATORS.filter(calc => {
      const matchesSearch = 
        calc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        calc.nameEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        calc.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === "all" || calc.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      
      {/* Hero Section */}
      <section className="bg-surface border-b border-border/80 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 bg-accent-soft text-accent text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            <Calculator className="w-3.5 h-3.5" /> Niche Financial Calculators Hub
          </div>
          
          <h1 className="text-4xl lg:text-6xl font-bold font-serif tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Finansal ve Muhasebe <br />
            <span className="text-accent">Hesaplama Motorları</span>
          </h1>
          
          <p className="text-base md:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Kurumsal finans, şirket değerleme, yatırım analizi ve niş muhasebe hesaplamalarını sıfır hata ve gerçek matematiksel doğruluk ile yapın. Reklamsız ve tamamen ücretsiz.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto relative pt-4">
            <span className="absolute left-4 top-7 text-muted">
              <Search className="w-5 h-5" />
            </span>
            <input 
              aria-label="Search financial calculators"
              type="text" 
              placeholder="Değerleme, WACC, NPV, Vergi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-full border border-border bg-background py-3 pl-12 pr-6 text-sm font-semibold tracking-wide shadow-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      </section>

      {/* Main Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 space-y-10">
        
        {/* Category Selector Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border pb-4">
          {[
            { id: "all", label: "Tümü (All)" },
            { id: "valuation", label: "Değerleme (Valuation)" },
            { id: "analysis", label: "Analiz (Analysis)" },
            { id: "investment", label: "Yatırım (Investment)" },
            { id: "tax", label: "Vergi & Muhasebe" }
          ].map((cat) => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 text-sm font-semibold rounded-full border transition-all cursor-pointer ${selectedCategory === cat.id ? "bg-accent border-accent text-surface" : "bg-surface border-border text-muted hover:border-foreground"}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Featured Pilot Product Hero Card */}
        {selectedCategory === "all" && searchTerm === "" && (
          <div className="rounded-2xl border border-accent bg-accent-soft/30 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center shadow-sm">
            <div className="lg:col-span-8 space-y-4">
              <span className="inline-flex bg-accent text-surface text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Pilot Product</span>
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">Şirket Değeri Hesaplama (Company Valuation)</h3>
              <p className="text-sm sm:text-base text-muted leading-relaxed">
                Şirketlerin gelecekteki nakit akışlarının bugünkü değerini (DCF) ve piyasa çarpanlarını (EBITDA Multiples) birleştirerek gerçek finansal değerini mühürlü formüllerle hesaplayan gelişmiş motorumuz yayında.
              </p>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1.5"><Percent className="w-4 h-4 text-accent" /> Gordon Growth Guard</span>
                <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-accent" /> Balance Sheet Debt Adjustment</span>
                <span className="flex items-center gap-1.5"><Layers className="w-4 h-4 text-accent" /> Custom SVG Charts & Print Layout</span>
              </div>
            </div>
            <div className="lg:col-span-4 lg:text-right">
              <Link 
                href="/calculators/company-valuation"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 font-semibold text-surface hover:bg-accent-hover transition-colors shadow"
              >
                Hesaplamaya Başla <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Calculators List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCalculators.map((calc) => (
            <div 
              key={calc.id} 
              className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${calc.isPilot ? "border-accent bg-surface hover:shadow-md" : "border-border bg-surface/50 opacity-80"}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${calc.category === "valuation" ? "bg-blue-100 text-blue-900" : calc.category === "analysis" ? "bg-purple-100 text-purple-900" : calc.category === "investment" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                    {calc.category}
                  </span>
                  {calc.isPilot ? (
                    <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Aktif</span>
                  ) : (
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Yakında</span>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-lg text-foreground font-serif">{calc.name}</h4>
                  <h5 className="text-xs text-muted font-mono">{calc.nameEn}</h5>
                </div>

                <p className="text-xs text-muted leading-relaxed line-clamp-3">{calc.description}</p>
              </div>

              <div className="pt-4 border-t border-border/60 mt-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">Tamamen Ücretsiz</span>
                {calc.isPilot ? (
                  <Link 
                    href={calc.href}
                    className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                  >
                    Kullan <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <span className="text-xs font-semibold text-muted/60">Geliştiriliyor</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredCalculators.length === 0 && (
          <div className="text-center py-12 rounded-xl border border-dashed border-border text-muted">
            Arama kriterlerine uygun hesaplama motoru bulunamadı.
          </div>
        )}

      </main>

      {/* Footer Details */}
      <footer className="border-t border-border/80 py-8 bg-surface text-center text-xs text-muted space-y-2">
        <p className="flex items-center justify-center gap-1">
          Made with <Heart className="w-3.5 h-3.5 text-red-600 fill-red-600" /> by CBAMValid Financial Engineering Group
        </p>
        <p className="text-[10px]">
          All formulas are locked to ground truth financial theory. Outputs are verified deterministically.
        </p>
      </footer>

    </div>
  );
}
