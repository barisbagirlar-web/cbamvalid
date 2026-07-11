import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/get-server-session";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return <>{children}</>;
}
