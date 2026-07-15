import { getServerSession } from "@/lib/auth/get-server-session";
import { redirect } from "next/navigation";
import { getCase } from "@/lib/cbam/storage/case-repository";
import { getAdminDb } from "@/lib/firebase/admin";
import CbamWizardClient from "./CbamWizardClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ caseId?: string }>;
}

export default async function NewCbamCasePage(props: PageProps) {
  const searchParams = await props.searchParams;
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  const caseId = searchParams.caseId;

  // caseId lookup (conditional) and entitlements query are independent - run in parallel
  const [cbamCase, entitlementsSnapshot] = await Promise.all([
    caseId ? getCase(caseId) : Promise.resolve(null),
    getAdminDb().collection("entitlements").where("uid", "==", session.uid).where("status", "==", "AVAILABLE").get(),
  ]);

  const initialCase = cbamCase && cbamCase.uid === session.uid ? cbamCase : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const availableEntitlements = entitlementsSnapshot.docs.map((doc: any) => doc.data());

  return (
    <CbamWizardClient
      sessionUser={{
        uid: session.uid,
        email: session.email,
      }}
      initialCase={initialCase}
      availableEntitlements={availableEntitlements}
    />
  );
}
