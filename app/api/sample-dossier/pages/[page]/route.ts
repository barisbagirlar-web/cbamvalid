import { NextResponse } from "next/server";
import { getAdminStorageBucket } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ page: string }> }) {
  try {
    const resolvedParams = await params;
    // page is expected to be '001', '002', etc.
    const pageStr = resolvedParams.page;
    if (!/^\d{3}$/.test(pageStr)) {
      return NextResponse.json({ error: "Invalid page format" }, { status: 400 });
    }

    const bucket = getAdminStorageBucket();
    const filePath = `sample-dossiers/public/v1/pages/page-${pageStr}.png`;
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const [buffer] = await file.download();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown sample page error" },
      { status: 500 }
    );
  }
}
