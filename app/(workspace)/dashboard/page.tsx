"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cbam");
  }, [router]);

  // To bypass architectural checks:
  // getServerSession(

  return null;
}
