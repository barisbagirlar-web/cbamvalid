import { PublicHeader } from "@/components/layout/PublicHeader";
import AppFooter from "@/components/layout/AppFooter";
import "./style.css";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="cbam-public">
      <PublicHeader />
      {children}
      <AppFooter />
    </div>
  );
}
