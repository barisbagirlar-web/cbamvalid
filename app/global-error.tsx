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
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <html>
      <body className="bg-kil-base text-kil-text antialiased min-h-screen">
        <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
          <div className="max-w-md w-full bg-kil-surface border border-kil-text/15 rounded-sm p-10 shadow-sm text-center">
            
            {/* ICON / EMBLEM */}
            <div className="w-12 h-12 bg-kil-accent/10 text-kil-accent flex items-center justify-center rounded-sm mx-auto mb-6">
              <span className="font-mono text-xl font-bold">!</span>
            </div>
            
            {/* HEADING */}
            <h2 className="font-serif text-2xl text-kil-text mb-4 tracking-tight">Unexpected Error</h2>
            
            <p className="text-sm text-kil-text/70 leading-relaxed mb-6">
              An unexpected technical issue occurred while processing this request. Your data remains secure. Please try recovering the session.
            </p>
            
            {/* ERROR DETAILS (MONO) */}
            <div className="bg-kil-base border border-kil-text/10 p-4 mb-8 text-left rounded-sm overflow-x-auto">
              <p className="font-mono text-xs text-kil-accent whitespace-pre-wrap break-words">
                {error.message || "Unknown interface rendering error."}
              </p>
            </div>

            {/* ACTIONS */}
            <div className="flex flex-col space-y-3">
              <button
                onClick={() => reset()}
                className="w-full bg-kil-text text-kil-surface py-3 text-sm font-medium rounded-sm hover:bg-kil-text/80 transition-colors cursor-pointer"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="w-full border border-kil-text/20 text-kil-text py-3 text-sm font-medium rounded-sm hover:bg-kil-surface transition-colors cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>

          </div>
        </div>
      </body>
    </html>
  );
}
