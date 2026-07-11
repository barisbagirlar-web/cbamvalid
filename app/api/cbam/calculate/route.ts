import { NextRequest, NextResponse } from "next/server";
import { requireFirebaseUser } from "@/lib/auth/require-firebase-user";
import { orchestrateCalculation } from "@/lib/cbam/engine/calculation-orchestrator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await requireFirebaseUser(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Convert to orchestrator input structure
    const calcInput = {
      role: body.role || "IMPORTER",
      importYear: Number(body.importYear || 2026),
      importQuarter: Number(body.importQuarter || 1),
      cnCode: body.cnCode,
      productionVolume: Number(body.productionVolume || 0),
      installationName: body.installationName || "",
      hasActualData: body.hasActualData || false,
      isVerified: body.isVerified || false,
      directEmissionsInput: Number(body.directEmissions || 0),
      electricityConsumedInput: Number(body.electricityConsumed || 0),
      gridEmissionFactorInput: Number(body.gridEmissionFactor || 0),
      isComplexGood: body.isComplexGood || false,
      precursorDirectEmissionsInput: Number(body.precursorDirectEmissions || 0),
      precursorIndirectEmissionsInput: Number(body.precursorIndirectEmissions || 0),
      carbonPricePaidInput: Number(body.carbonPricePaid || 0),
    };

    const calcResult = orchestrateCalculation(calcInput);

    return NextResponse.json({
      status: "success",
      calculation: calcResult,
    });
  } catch (error: any) {
    console.error("[CALCULATE ENDPOINT ERROR]:", error.message || error);
    const status = error.status || 500;
    return NextResponse.json({ error: error.message || "Failed to calculate emissions preview" }, { status });
  }
}
