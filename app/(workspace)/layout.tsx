import { AppHeader } from "@/components/layout/AppHeader";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-soft">
      <AppHeader />
      <main className="flex-1 max-w-[1440px] mx-auto w-full px-6 py-8">
        {children}
      </main>
    </div>
  );
}
