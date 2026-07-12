import { PublicHeader } from "@/components/layout/PublicHeader";
import AppFooter from "@/components/layout/AppFooter";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </>
  );
}
