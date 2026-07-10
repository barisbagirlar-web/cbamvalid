import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session-cookie";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ reportId: string }> }) {
  try {
    const params = await props.params;
    const reportId = params.reportId;
    
    // 1. Session check
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch report
    const doc = await adminDb.collection("cbam_reports").doc(reportId).get();
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
    return NextResponse.json({ error: error.message || "Failed to fetch report detail" }, { status: 500 });
  }
}
