import { getServerSessionRevocationSensitive } from "@/lib/auth/get-server-session";
import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerSessionRevocationSensitive();
  
  if (!session || !session.admin) {
    redirect("/login");
  }

  return <AdminClient />;
}
