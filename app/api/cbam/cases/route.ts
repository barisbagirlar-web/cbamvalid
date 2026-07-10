import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session-cookie";
import { createCase, updateCase, verifyCaseOwner } from "@/lib/cbam/storage/case-repository";
import { adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await adminDb
      .collection("cbam_cases")
      .where("uid", "==", session.uid)
      .get();

    const cases = snapshot.docs
      .map((doc: any) => doc.data())
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return NextResponse.json({ status: "success", cases });
  } catch (error: any) {
    console.error("[CASES GET ENDPOINT ERROR]:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to fetch draft cases" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { caseId, data } = await request.json();

    if (!data) {
      return NextResponse.json({ error: "Missing data payload" }, { status: 400 });
    }

    let cbamCase;
    if (caseId) {
      // Update case
      cbamCase = await updateCase(caseId, session.uid, data);
    } else {
      // Create case
      cbamCase = await createCase(session.uid, data);
    }

    return NextResponse.json({ status: "success", case: cbamCase });
  } catch (error: any) {
    console.error("[CASES POST ENDPOINT ERROR]:", error.message || error);
    return NextResponse.json({ error: error.message || "Failed to save draft case" }, { status: 500 });
  }
}
