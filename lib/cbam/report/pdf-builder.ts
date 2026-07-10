import { jsPDF } from "jspdf";
import { CalculationOutput } from "../engine/calculation-orchestrator";

/**
 * Builds the cost evidence PDF report dossier and returns it as a Buffer
 */
export function buildPdfDossier(data: any, calc: CalculationOutput, docHash?: string, isSample?: boolean): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  if (isSample) {
    doc.setTextColor(220, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SAMPLE REPORT - Fictional demonstration data - Not valid for regulatory use", 15, 10);
    doc.setTextColor(0, 0, 0);
  }

  // Metadata isolation
  doc.setProperties({
    title: `CBAM_Dossier_${data.cnCode}`,
    author: "CBAMValid Portal",
    creator: "CBAMValid Sealing Engine",
  });

  // Header & Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CBAM DEFINITIVE EVIDENCE & COST DOSSIER", 15, 20);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated At: ${new Date().toISOString()}`, 195, 20, { align: "right" });
  doc.line(15, 25, 195, 25);

  // Section 1: Declarant
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("1. Importer & Declarant Information", 15, 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`EORI: ${data.declarantEORI || "N/A"}`, 15, 40);
  doc.text(`Reporting Year: ${calc.inputs.importYear}`, 15, 45);
  doc.text(`Goods Classification CN Code: ${calc.inputs.cnCode}`, 15, 50);

  // Section 2: Installation
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("2. Installation & Production Information", 15, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Installation Name: ${data.installationName || "N/A"}`, 15, 66);
  doc.text(`Production Volume: ${data.productionVolume} ${calc.applicability.sector === "ELECTRICITY" ? "MWh" : "Tonnes"}`, 15, 71);
  doc.text(`Complex Good: ${data.isComplexGood ? "Yes" : "No"}`, 15, 76);

  // Section 3: Calculation Pathway & Applicability
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("3. CBAM Applicability & Pathway Validation", 15, 85);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`CBAM Sector: ${calc.applicability.sector}`, 15, 92);
  doc.text(`Applicability Status: ${calc.applicability.isApplicable ? "APPLICABLE" : "EXEMPT/EXCLUDED"}`, 15, 97);
  doc.text(`Under de minimis mass threshold (50t): ${calc.applicability.underThreshold ? "Yes (Exempt)" : "No (Subject to CBAM)"}`, 15, 102);
  doc.text(`Pathway Checked: ${calc.pathway.pathway}`, 15, 107);
  if (calc.pathway.requiresVerificationWarning) {
    doc.setTextColor(200, 0, 0);
    doc.text("WARNING: Actual emissions unverified! ACCREDITED VERIFICATION REQUIRED.", 15, 112);
    doc.setTextColor(0, 0, 0);
  }

  // Section 4: Emissions Inventory
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("4. Embedded Emissions Summary", 15, 121);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Specific Direct Emissions: ${calc.specificDirectEmissions} tCO2e/unit`, 15, 128);
  doc.text(`Specific Indirect Emissions: ${calc.specificIndirectEmissions} tCO2e/unit`, 15, 133);
  doc.text(`Total Direct Emissions: ${calc.totalDirectEmissions} tCO2e`, 15, 138);
  doc.text(`Total Indirect Emissions: ${calc.totalIndirectEmissions} tCO2e`, 15, 143);
  doc.text(`Total Embedded Emissions: ${calc.totalEmbeddedEmissions} tCO2e`, 15, 148);

  // Section 5: Financial Exposure & Cost
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("5. CBAM Exposure & Cost Calculations", 15, 157);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Free Allocation Adjustment: -${calc.freeAllocationAdjustment} tCO2e`, 15, 164);
  doc.text(`Carbon Price Paid Deduction: -${calc.carbonPriceDeduction} tCO2e`, 15, 169);
  doc.text(`Net CBAM Certificates Due: ${calc.netCertificatesDue} units`, 15, 174);
  doc.text(`Certificate Price Resolved: ${calc.pricing.priceEurPerTonne} EUR/unit (${calc.pricing.state})`, 15, 179);
  doc.text(`Estimated CBAM Financial Exposure: ${calc.estimatedCertificateCostEur} EUR`, 15, 184);

  // Section 6: Provenance & Seals
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("6. Sealing & Provenance Integrity", 15, 193);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Calculation engine version: v1.0.0-deterministic`, 15, 200);
  doc.text(`Regulatory ruleset dataset: ${calc.pricing.datasetVersion}`, 15, 205);
  if (docHash) {
    doc.setFont("helvetica", "bold");
    doc.text(`DOCUMENT SEAL SHA-256 HASH: ${docHash}`, 15, 212);
    doc.setFont("helvetica", "normal");
  }

  // Disclaimer
  doc.line(15, 220, 195, 220);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 150, 150);
  doc.text("LEGAL NOTICE", 15, 228);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  const legalNotice =
    "Independent compliance software. Not affiliated with, endorsed by, or sponsored by the European Union or the European Commission. The values stated in this document are generated based on the inputs provided by the declarant. The platform acts solely as a computational tool and holds no legal liability regarding the accuracy of the data or any customs penalties applied by the EU authorities.";
  const splitNotice = doc.splitTextToSize(legalNotice, 180);
  doc.text(splitNotice, 15, 234);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
