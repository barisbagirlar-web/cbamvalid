import type { Metadata } from "next";
import Link from "next/link";

/**
 * Global hard-404 surface for unmatched public URLs.
 * Must not look like an app shell (dashboard CTA + homepage metadata = soft-404 risk).
 */
export const metadata: Metadata = {
  title: "Page not found",
  description: "This URL does not match a published CBAMValid page.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-kil-base px-6">
      <div className="max-w-md w-full bg-kil-surface border border-kil-text/15 rounded-sm p-10 shadow-sm text-center">
        <p className="font-mono text-6xl text-kil-text/20 tabular-nums tracking-tighter mb-4" aria-hidden="true">
          404
        </p>
        <h1 className="font-serif text-2xl text-kil-text mb-4 tracking-tight">Page not found</h1>
        <p className="text-sm text-kil-text/70 leading-relaxed mb-8">
          This URL is not a published CBAMValid page. Refund requests use the refund policy page; product and
          support links below stay on the public site.
        </p>
        <nav className="flex flex-col gap-3" aria-label="Public recovery links">
          <Link
            href="/"
            className="inline-block border border-kil-text/20 text-kil-text px-8 py-3 text-sm font-medium rounded-sm hover:bg-kil-text/5 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/refund-policy"
            className="inline-block border border-kil-text/20 text-kil-text px-8 py-3 text-sm font-medium rounded-sm hover:bg-kil-text/5 transition-colors"
          >
            Refund policy
          </Link>
          <Link
            href="/contact"
            className="inline-block border border-kil-text/20 text-kil-text px-8 py-3 text-sm font-medium rounded-sm hover:bg-kil-text/5 transition-colors"
          >
            Contact
          </Link>
        </nav>
      </div>
    </main>
  );
}
