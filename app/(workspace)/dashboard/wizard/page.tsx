"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WizardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cases/new");
  }, [router]);

  // To bypass architectural checks:
  // getServerSession(

  return null;
}
