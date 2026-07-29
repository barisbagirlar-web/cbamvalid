import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.NEXT_PUBLIC_CBAM_RELEASE_SHA || "NOT_PROVEN";
  const proven = /^[a-f0-9]{40}$/.test(sha);

  return NextResponse.json(
    {
      status: proven ? "PASS" : "NOT_PROVEN",
      commitSha: sha,
      service: "ssrcbamdesk",
    },
    {
      status: proven ? 200 : 503,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    }
  );
}
