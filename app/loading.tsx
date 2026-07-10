export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
      <div className="flex flex-col items-center">
        {/* Minimalist Spinner */}
        <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
        <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">
          Veriler Hazırlanıyor...
        </p>
      </div>
    </div>
  );
}
