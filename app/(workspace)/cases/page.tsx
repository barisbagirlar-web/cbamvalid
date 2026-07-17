"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CasesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cbam");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
    </div>
  );
}
