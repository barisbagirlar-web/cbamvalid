import { AuthProvider } from "@/context/AuthProvider";
import { AuthHeader } from "@/components/layout/AuthHeader";
import AppFooter from "@/components/layout/AppFooter";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AuthHeader />
      <main className="flex-1">{children}</main>
      <AppFooter />
    </AuthProvider>
  );
}
