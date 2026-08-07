import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { Teb232CaseReconciler } from "@/components/cbam/Teb232CaseReconciler";
import { Teb232TargetCasePreparer } from "@/components/cbam/Teb232TargetCasePreparer";

export const metadata: Metadata = {
  other: {
    google: "notranslate",
  },
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div
        className="notranslate min-h-screen flex flex-col bg-surface-soft"
        translate="no"
        data-workspace-translation-policy="disabled"
      >
        <Teb232CaseReconciler />
        <Teb232TargetCasePreparer />
        <AppHeader />
        <main className="flex-1 max-w-[1440px] mx-auto w-full px-6 py-8">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
