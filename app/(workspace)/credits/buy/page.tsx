import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import BuyCreditsPageClient from "./BuyCreditsPageClient";

export default function BuyCreditsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-accent" aria-hidden="true" />
          <p className="text-sm text-muted">Loading checkout…</p>
        </main>
      }
    >
      <BuyCreditsPageClient />
    </Suspense>
  );
}
