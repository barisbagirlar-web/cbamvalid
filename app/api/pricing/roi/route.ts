import { NextResponse } from "next/server";
import { z } from "zod";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { ROI_SECTORS, calculateDefaultValuePenalty } from "@/lib/billing/roi-calculator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  sector: z.string(),
  volumeTonnes: z.number().nullable(),
  actualSeeTPerT: z.number().nullable(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "ROI_BODY_INVALID",
        message: "Request body must be JSON.",
        calculatorVersion: "roi-exposure-v1.0.0",
      },
      { status: 400 }
    );
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "ROI_INPUT_SCHEMA",
        message: "Provide sector, volumeTonnes, and actualSeeTPerT. Missing fields are not coerced to zero.",
        calculatorVersion: "roi-exposure-v1.0.0",
        sectors: ROI_SECTORS,
      },
      { status: 400 }
    );
  }

  const result = calculateDefaultValuePenalty({
    sector: parsed.data.sector,
    volumeTonnes: parsed.data.volumeTonnes,
    actualSeeTPerT: parsed.data.actualSeeTPerT,
    packPriceUsd: Number(CANONICAL_PRICING.displayPrice),
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

export async function GET() {
  return NextResponse.json({
    calculatorVersion: "roi-exposure-v1.0.0",
    sectors: ROI_SECTORS,
    certificatePin: "EU_CBAM_PRICE_2026_Q2 · €75.28/tCO2e · OFFICIAL_PUBLISHED",
    packPriceUsd: Number(CANONICAL_PRICING.displayPrice),
    notice:
      "POST JSON { sector, volumeTonnes, actualSeeTPerT }. Missing inputs block — never silent zero.",
  });
}
