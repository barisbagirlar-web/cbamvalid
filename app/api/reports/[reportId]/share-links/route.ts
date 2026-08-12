import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFirebaseSession } from "@/lib/auth/require-firebase-session";
import { createShareLink, listShareLinks } from "@/lib/verify/share-links";

const CreateSchema = z.object({ label: z.string().trim().min(1).max(120) });

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
  const status = message === "REPORT_FORBIDDEN" ? 403 : message === "REPORT_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, props: { params: Promise<{ reportId: string }> }) {
  try {
    const auth = await requireFirebaseSession(request);
    const { reportId } = await props.params;
    return NextResponse.json({ data: await listShareLinks(reportId, auth.uid) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, props: { params: Promise<{ reportId: string }> }) {
  try {
    const auth = await requireFirebaseSession(request);
    const { reportId } = await props.params;
    const { label } = CreateSchema.parse(await request.json());
    const created = await createShareLink({ reportId, uid: auth.uid, label });
    return NextResponse.json(
      { data: { ...created, url: `/share/${created.token}` } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
