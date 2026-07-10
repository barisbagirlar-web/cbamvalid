import { requireAdmin } from "@/lib/auth/require-session";
import AdminClient from "./AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();

  return <AdminClient />;
}
