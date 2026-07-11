import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/auth/require-firebase-user";
import { getAdminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ reportId: string }> }) {
  try {
    const params = await props.params;
    const reportId = params.reportId;
    
    // 1. Session check
    const session = await requireFirebaseUser(request);

    // 2. Fetch report
    const doc = await getAdminDb().collection("cbam_reports").doc(reportId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const report = doc.data() as any;

    // 3. Confirm ownership
    if (report.uid !== session.uid) {
      return NextResponse.json({ error: "Forbidden: You do not own this report" }, { status: 403 });
    }

    return NextResponse.json({
      status: "success",
      report,
    });
  } catch (error: any) {
    console.error("[REPORT GET ENDPOINT ERROR]:", error.message || error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || "Failed to fetch report detail" }, { status });
  }
}
