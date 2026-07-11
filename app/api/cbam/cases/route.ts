import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/auth/require-firebase-user";
import { createCase, updateCase, getCase } from "@/lib/cbam/storage/case-repository";
import { getAdminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireFirebaseUser(request);
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get("caseId");

    if (caseId) {
      const cbamCase = await getCase(caseId);
      if (!cbamCase) {
        return NextResponse.json({ error: "Case not found" }, { status: 404 });
      }
      if (cbamCase.uid !== session.uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ status: "success", case: cbamCase });
    }

    const snapshot = await getAdminDb()
      .collection("cbam_cases")
      .where("uid", "==", session.uid)
      .get();

    const cases = snapshot.docs
      .map((doc: any) => doc.data())
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    return NextResponse.json({ status: "success", cases });
  } catch (error: any) {
    console.error("[CASES GET ENDPOINT ERROR]:", error.message || error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || "Failed to fetch draft cases" }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireFirebaseUser(request);
    const { caseId, data } = await request.json();

    if (!data) {
      return NextResponse.json({ error: "Missing data payload" }, { status: 400 });
    }

    let cbamCase;
    if (caseId) {
      cbamCase = await updateCase(caseId, session.uid, data);
    } else {
      cbamCase = await createCase(session.uid, data);
    }

    return NextResponse.json({ status: "success", case: cbamCase });
  } catch (error: any) {
    console.error("[CASES POST ENDPOINT ERROR]:", error.message || error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || "Failed to save draft case" }, { status });
  }
}
