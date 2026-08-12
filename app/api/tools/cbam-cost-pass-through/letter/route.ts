import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

function eur(value: number): string {
  return `EUR ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function POST(request: Request) {
  try {
    const payload = InputSchema.parse(await request.json());
    const result = calculateCbamPassThrough(payload);
    const base = result.scenarios.find((scenario) => scenario.label === "base")!;

    const pdf = await PDFDocument.create();
    pdf.setTitle("CBAM Cost Impact Letter");
    pdf.setAuthor("CBAMValid");
    pdf.setSubject(`CBAM cost impact planning model for CN ${result.normalizedInput.cnCode}`);
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    let y = height - 58;

    const line = (text: string, size = 10, isBold = false) => {
      page.drawText(text, { x: 56, y, size, font: isBold ? bold : regular, color: rgb(0.08, 0.1, 0.14) });
      y -= size + 8;
    };

    line("CBAMValid", 12, true);
    line("CBAM Cost Impact Letter", 20, true);
    y -= 6;
    line(`CN code: ${result.normalizedInput.cnCode}`);
    line(`Contract basis: ${result.normalizedInput.tonnage} t | Incoterm ${result.normalizedInput.incoterm}`);
    line(`Embedded emissions: ${result.normalizedInput.embeddedEmissionsTco2PerT} tCO2e/t`);
    line(`Modeled CBAM exposure: ${result.normalizedInput.cbamExposurePct}%`);
    line(`Base EUA / certificate price assumption: ${eur(result.normalizedInput.euaPriceEurPerTco2)} / tCO2e`);
    line(`Carbon price paid assumption: ${eur(result.normalizedInput.carbonPricePaidEurPerTco2)} / tCO2e`);
    y -= 10;
    line("Base-case commercial impact", 14, true);
    line(`Certificate cost per tonne: ${eur(base.certificateCostPerTonneEur)}`);
    line(`Total modeled contract impact: ${eur(base.totalContractImpactEur)}`, 12, true);
    line(`Contract value impact: ${base.marginImpactPct == null ? "not calculated" : `${base.marginImpactPct.toFixed(2)}%`}`);
    y -= 10;
    line("Scenario range", 14, true);
    for (const scenario of result.scenarios) {
      line(`${scenario.label.toUpperCase()}: ${eur(scenario.euaPriceEurPerTco2)}/tCO2e -> ${eur(scenario.totalContractImpactEur)}`);
    }
    y -= 10;
    line("Audit trail", 14, true);
    line(`Engine version: ${result.engineVersion}`);
    line(`Payable embedded emissions: ${result.payableEmbeddedEmissionsTco2} tCO2e`);
    line("Formula: tonnage x embedded emissions x exposure % x max(EUA price - carbon price paid, 0)", 9);
    for (const assumption of result.assumptions) line(`- ${assumption}`, 8);

    page.drawText("Generated with CBAMValid — cbamvalid.com", { x: 56, y: 38, size: 8, font: bold });
    page.drawText("Planning model only; not an official declaration, verification opinion or legal advice.", { x: 56, y: 25, size: 7, font: regular });

    const bytes = await pdf.save({ useObjectStreams: false });
    if (pdf.getPageCount() > 2) throw new Error("PDF_PAGE_LIMIT_EXCEEDED");

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="CBAM-Cost-Impact-${result.normalizedInput.cnCode}.pdf"`,
        "Cache-Control": "no-store",
        "X-CBAMValid-Engine-Version": result.engineVersion,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_REQUEST";
    return NextResponse.json({ error: "LETTER_GENERATION_FAILED", detail: message }, { status: 400 });
  }
}
