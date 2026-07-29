"use client";

import { AuthProvider } from "@/context/AuthProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { usePathname } from "next/navigation";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <AuthProvider>
      <div className={isAdminRoute ? "min-h-screen" : "min-h-screen flex flex-col bg-surface-soft"}>
        {!isAdminRoute && <AppHeader />}
        <main className={isAdminRoute ? "min-h-screen" : "flex-1 max-w-[1440px] mx-auto w-full px-6 py-8"}>
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
