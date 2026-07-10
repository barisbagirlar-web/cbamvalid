import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const gitSha = process.env.RELEASE_SHA || process.env.NEXT_PUBLIC_RELEASE_SHA || "ada987e461bebe3d8de6eeeadda328ae3cd7d1bd";
  const buildId = process.env.BUILD_ID || process.env.NEXT_PUBLIC_BUILD_ID || "commercial-v3.0.1-auth-hotfix-build";

  return NextResponse.json({
    service: "cbamvalid",
    environment: "production",
    release: "commercial-v3.0.1-auth-hotfix",
    gitSha: gitSha,
    buildId: buildId
  }, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-CBAM-Build": buildId,
      "X-CBAM-Commit": gitSha
    }
  });
}
