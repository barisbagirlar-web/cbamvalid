import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const doc = await adminDb.collection("sample_dossiers").doc("v1").get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: "Sample dossier not generated yet" }, { status: 404 });
    }

    const data = doc.data()!;
    
    return NextResponse.json({
      version: data.version,
      pageCount: data.pageCount,
      generatedAt: data.generatedAt,
      // We don't return canonicalHash publicly
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
