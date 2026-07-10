import { requireSession } from "@/lib/auth/require-session";
import { redirect } from "next/navigation";

export default async function WizardPage() {
  await requireSession();
  redirect("/cbam/new");
}
