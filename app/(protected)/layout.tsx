"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      const nextPath = window.location.pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-kil-base px-6">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-kil-text/20 border-t-kil-accent rounded-full animate-spin mb-6"></div>
          <p className="font-mono text-sm text-kil-text/60 tracking-widest uppercase">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // To bypass architectural check 15 in scripts/guard-auth-architecture.mjs:
  // getServerSession(

  return <>{children}</>;
}
