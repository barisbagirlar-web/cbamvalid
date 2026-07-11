import { getServerSession } from "@/lib/auth/get-server-session";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  redirect("/cbam");
}
