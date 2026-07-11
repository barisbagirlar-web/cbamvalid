import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/get-server-session";
import { verifyCaseOwner } from "@/lib/cbam/storage/case-repository";
import { sealReport } from "@/lib/cbam/report/seal-service";

export const dynamic = "force-dynamic";

function verifyOrigin(request: Request): boolean {
  const origin = request.headers.get("origin") || "";
  const allowed = process.env.AUTH_ALLOWED_ORIGINS || "";
  const allowedList = allowed.split(",").map((o) => o.trim().toLowerCase());
  return allowedList.includes(origin.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    // 1. Same-Origin Check
    if (!verifyOrigin(request)) {
      return NextResponse.json({ error: "Forbidden: Invalid origin policy." }, { status: 403 });
    }

    // 2. Session check
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 3. Request inputs validation
    const { caseId, entitlementId } = await request.json();

    if (!caseId || !entitlementId) {
      return NextResponse.json({ error: "Missing caseId or entitlementId parameter" }, { status: 400 });
    }

    // 4. Retrieve draft case and verify owner
    const cbamCase = await verifyCaseOwner(caseId, session.uid);

    // 5. Seal report using the entitlement allocation
    const sealedResult = await sealReport({
      uid: session.uid,
      caseId,
      entitlementId,
      inputData: cbamCase.data,
    });

    // 6. Return metadata results
    return NextResponse.json({
      status: "success",
      reportId: sealedResult.reportId,
      documentHash: sealedResult.documentHash,
    });
  } catch (error: any) {
    console.error("[REPORT SEALING ENDPOINT ERROR]:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to seal dossier report" }, { status: 500 });
  }
}
