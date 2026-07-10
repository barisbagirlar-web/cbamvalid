"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Gelecekte Sentry veya Datadog gibi bir loglama servisi bağlanacaksa:
    console.error("Global Hata Yakalandı:", error);
  }, [error]);

  return (
    <html>
      <body className="bg-kil-base text-kil-text antialiased min-h-screen">
        <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
          <div className="max-w-md w-full bg-kil-surface border border-kil-text/15 rounded-sm p-10 shadow-sm text-center">
            
            {/* İKON / VURGU */}
            <div className="w-12 h-12 bg-kil-accent/10 text-kil-accent flex items-center justify-center rounded-sm mx-auto mb-6">
              <span className="font-mono text-xl font-bold">!</span>
            </div>
            
            {/* BAŞLIK */}
            <h2 className="font-serif text-2xl text-kil-text mb-4 tracking-tight">Beklenmeyen Durum</h2>
            
            <p className="text-sm text-kil-text/70 leading-relaxed mb-6">
              Sistem bu işlemi gerçekleştirirken teknik bir aksaklık yaşadı. Verileriniz güvende olabilir, lütfen işlemi kurtarmayı deneyin.
            </p>
            
            {/* HATA DETAYI (MONO) */}
            <div className="bg-kil-base border border-kil-text/10 p-4 mb-8 text-left rounded-sm overflow-x-auto">
              <p className="font-mono text-xs text-kil-accent whitespace-pre-wrap break-words">
                {error.message || "Bilinmeyen bir arayüz işleme hatası."}
              </p>
            </div>

            {/* AKSİYONLAR */}
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => reset()}
                className="w-full bg-kil-text text-kil-surface py-3 text-sm font-medium rounded-sm hover:bg-kil-text/80 transition-colors cursor-pointer"
              >
                İşlemi Yeniden Dene
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full border border-kil-text/20 text-kil-text py-3 text-sm font-medium rounded-sm hover:bg-kil-surface transition-colors cursor-pointer"
              >
                Kontrol Paneline Dön
              </button>
            </div>

          </div>
        </div>
      </body>
    </html>
  );
}
