import { AppHeader } from "@/components/layout/AppHeader";
import { requireAuthenticatedSession } from "@/lib/auth/session-gate";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireAuthenticatedSession();
  return (
    <div className="flex min-h-screen flex-col bg-surface-soft">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
