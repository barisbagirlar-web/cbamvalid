import { requireSession } from "@/lib/auth/require-session";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  await requireSession();
  redirect("/cbam");
}
