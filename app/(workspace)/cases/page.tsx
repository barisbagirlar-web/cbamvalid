"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CasesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cbam");
  }, [router]);

  return null;
}
