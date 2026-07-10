import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
      <div className="max-w-md w-full bg-kil-surface border border-kil-text/15 rounded-sm p-10 shadow-sm text-center">
        
        <div className="font-mono text-6xl text-kil-text/20 tabular-nums tracking-tighter mb-4">
          404
        </div>
        
        <h2 className="font-serif text-2xl text-kil-text mb-4 tracking-tight">Kayıt Bulunamadı</h2>
        
        <p className="text-sm text-kil-text/70 leading-relaxed mb-8">
          Aradığınız rapor, bağlantı veya sayfa sistemimizde yer almıyor veya taşınmış olabilir.
        </p>

        <Link 
          href="/dashboard"
          className="inline-block border border-kil-text/20 text-kil-text px-8 py-3 text-sm font-medium rounded-sm hover:bg-kil-text/5 transition-colors cursor-pointer"
        >
          Kontrol Paneline Dön
        </Link>
      </div>
    </div>
  );
}
