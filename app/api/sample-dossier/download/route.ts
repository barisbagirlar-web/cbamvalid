import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Legacy path — gate-free static sample PDF. No login required. */
export async function GET(request: Request) {
  return NextResponse.redirect(
    new URL("/sample-dossier/CBAMValid-Sample-Dossier.pdf", request.url),
    308
  );
}
