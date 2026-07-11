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

  let initialCase = null;
  if (caseId) {
    const cbamCase = await getCase(caseId);
    if (cbamCase && cbamCase.uid === session.uid) {
      initialCase = cbamCase;
    }
  }

  // Fetch available entitlements for the user
  const entitlementsSnapshot = await getAdminDb()
    .collection("entitlements")
    .where("uid", "==", session.uid)
    .where("status", "==", "AVAILABLE")
    .get();

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
