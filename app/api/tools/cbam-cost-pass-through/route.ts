import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateCbamPassThrough } from "@/lib/tools/cbam-pass-through";

const InputSchema = z.object({
  cnCode: z.string().min(4).max(10),
  tonnage: z.number().finite().nonnegative(),
  embeddedEmissionsTco2PerT: z.number().finite().nonnegative(),
  euaPriceEurPerTco2: z.number().finite().nonnegative(),
  cbamExposurePct: z.number().finite().min(0).max(100),
  carbonPricePaidEurPerTco2: z.number().finite().nonnegative(),
  contractValueEur: z.number().finite().nonnegative().optional(),
  incoterm: z.string().length(3),
});

export async function POST(request: Request) {
  try {
    const payload = InputSchema.parse(await request.json());
    const result = calculateCbamPassThrough(payload);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store", "X-CBAMValid-Engine-Version": result.engineVersion },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_REQUEST";
    return NextResponse.json({ error: "INVALID_INPUT", detail: message }, { status: 400 });
  }
}
