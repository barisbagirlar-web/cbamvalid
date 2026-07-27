import { PublicHeader } from "@/components/layout/PublicHeader";
import AppFooter from "@/components/layout/AppFooter";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <link rel="stylesheet" href="/assets/css/style.css" />
      <PublicHeader />
      {children}
      <AppFooter />
    </>
  );
}
