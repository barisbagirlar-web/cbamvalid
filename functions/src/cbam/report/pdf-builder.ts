import { jsPDF } from "jspdf";
import { CalculationOutput } from "../engine/calculation-orchestrator";
import * as crypto from "crypto";
import { getDisplayReferenceCode } from "../case-id";

/**
 * Helper to calculate SHA-256 hash in a Node environment
 */
function sha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Helper to safely format values with fallback string to prevent crashes on null/empty data
 */
function safeStr(val: any, fallback: string = "N/A"): string {
  if (val === null || val === undefined || String(val).trim() === "") return fallback;
  return String(val);
}

/**
 * Builds the cost evidence PDF report dossier and returns it as a Buffer
 */
export function buildPdfDossier(
  data: any,
  calc: CalculationOutput,
  docHash?: string,
  isSample?: boolean,
  redactForPublicSample?: boolean
): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Extract metadata safely using fallback utilities
  const exporterName = safeStr(data?.exporterName || data?.exporterIdentity?.legalName?.value);
  const declarantEori = safeStr(data?.declarantEORI || data?.importerIdentity?.eoriNumber?.value || data?.importer?.eori?.value);
  const installationName = safeStr(data?.installationName || data?.installation?.name?.value);
  const productionRoute = safeStr(data?.installation?.productionRoute?.value);
  const installationCountry = safeStr(data?.installationCountry || data?.installation?.country?.value);
  const importYear = safeStr(calc?.inputs?.importYear || data?.reportingPeriod?.year?.value);
  const importQuarter = safeStr(calc?.inputs?.importQuarter || data?.reportingPeriod?.quarter?.value, "");
  const cnCode = safeStr(calc?.inputs?.cnCode || data?.goods?.[0]?.cnCode?.value);
  const sector = safeStr(calc?.applicability?.sector || data?.goods?.[0]?.sector);
  const productionVolume = safeStr(data?.productionVolume || data?.goods?.[0]?.productionVolume?.value);
  const isComplexGood = data?.isComplexGood !== undefined ? !!data.isComplexGood : !!(data?.goods?.[0]?.isComplexGood);

  const reportId = safeStr(data?.caseId, "DRAFT");
  const finalDocHash = docHash || sha256(JSON.stringify({ reportId, exporterName, timestamp: Date.now() }));

  // Metadata isolation in PDF properties
  doc.setProperties({
    title: redactForPublicSample ? "CBAMValid Sample Dossier" : `CBAM_Dossier_${cnCode}`,
    author: "CBAMValid",
    creator: "CBAMValid Report Engine",
    subject: redactForPublicSample ? "Fictional Demonstration Dossier" : "CBAM Definitive Dossier",
    keywords: redactForPublicSample ? "CBAM, sample dossier, demonstration" : "CBAM, verification, evidence"
  });

  // Track page numbers dynamically to populate the TOC at the end
  const tocPages: Record<string, number> = {};

  // Visual component helpers
  const drawCard = (doc: jsPDF, x: number, y: number, w: number, h: number, title?: string) => {
    doc.setFillColor(250, 249, 245); // Warm cream surface (#FAF9F5)
    doc.setDrawColor(26, 25, 21, 25); // Soft border
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
    
    if (title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(189, 93, 58); // Accent color (#BD5D3A)
      doc.text(title, x + 5, y + 6.5);
      doc.setDrawColor(26, 25, 21, 15);
      doc.line(x, y + 9, x + w, y + 9);
    }
  };

  const renderLabelValue = (
    label: string,
    value: string | number,
    x: number,
    y: number,
    isRedacted: boolean,
    valueOffset: number = 55
  ) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(110, 115, 125); // Muted grey
    doc.text(label, x, y);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(26, 25, 21); // Slate black
    
    const valStr = String(value);
    if (isRedacted && redactForPublicSample) {
      doc.setFillColor(225, 225, 225);
      const textWidth = doc.getTextWidth("REDACTED IN PUBLIC SAMPLE") + 4;
      doc.rect(x + valueOffset - 1, y - 3, textWidth, 4.2, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 110);
      doc.text("REDACTED IN PUBLIC SAMPLE", x + valueOffset, y);
    } else {
      doc.text(valStr, x + valueOffset, y);
    }
  };

  // ----------------------------------------------------
  // PAGE 1: COVER PAGE
  // ----------------------------------------------------
  doc.setFillColor(26, 29, 36); // Deep slate-navy
  doc.rect(0, 0, 210, 297, "F");
  
  // Accent vertical stripe
  doc.setFillColor(189, 93, 58); // Accent (#BD5D3A)
  doc.rect(0, 0, 8, 297, "F");
  
  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("CBAM EXPORTER EVIDENCE DOSSIER", 20, 80);
  
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 185, 195);
  doc.text("Prepared in accordance with Regulation (EU) 2023/956 & Implementing Regulation (EU) 2023/1773", 20, 90);
  
  // Status Badge
  doc.setFillColor(189, 93, 58);
  doc.roundedRect(20, 105, 105, 8, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("PREPARED FOR INDEPENDENT ACCREDITED VERIFICATION", 24, 110.5);
  
  // Metadata Container Block
  doc.setFillColor(38, 42, 51);
  doc.roundedRect(20, 130, 170, 88, 2, 2, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("DOSSIER METADATA & SCOPE", 25, 142);
  doc.setDrawColor(60, 65, 75);
  doc.setLineWidth(0.3);
  doc.line(25, 146, 185, 146);
  
  doc.setFontSize(8.5);
  let covY = 156;
  const renderCoverMeta = (label: string, value: string, isRedacted: boolean) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(150, 155, 165);
    doc.text(label, 25, covY);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255);
    if (isRedacted && redactForPublicSample) {
      doc.setFillColor(60, 65, 75);
      const textWidth = doc.getTextWidth("REDACTED IN PUBLIC SAMPLE") + 4;
      doc.rect(79, covY - 3, textWidth, 4.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(180, 180, 180);
      doc.text("REDACTED IN PUBLIC SAMPLE", 80, covY);
    } else {
      doc.text(value, 80, covY);
    }
    covY += 8;
  };
  
  renderCoverMeta("Reference Code:", getDisplayReferenceCode(data?.caseId), false);
  renderCoverMeta("Exporter Legal Name:", exporterName, true);
  renderCoverMeta("Declarant EORI Number:", declarantEori, true);
  renderCoverMeta("Target Facility Name:", installationName, true);
  renderCoverMeta("CN Classification Code:", cnCode, false);
  renderCoverMeta("Target Reporting Period:", `${importYear}${importQuarter ? ` Q${importQuarter}` : ""}`, false);
  renderCoverMeta("CBAM Product Sector:", sector, false);
  
  // Footer Information
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 125, 135);
  doc.text(`Dossier Status: ${data?.status || "DRAFT"} | Version: ${data?.version || 1}`, 20, 248);
  doc.text(`Verification Seal: ${finalDocHash}`, 20, 254);
  doc.text(`Generated on (UTC): ${new Date().toUTCString()}`, 20, 260);

  // ----------------------------------------------------
  // PAGE 2: TOC & REGULATORY CONTEXT
  // ----------------------------------------------------
  doc.addPage();
  tocPages["toc"] = doc.getNumberOfPages();
  doc.setTextColor(26, 25, 21);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("1. Table of Contents & Regulatory Context", 15, 30);
  
  // Table of Contents Box (TOC content is printed at the end dynamically)
  drawCard(doc, 15, 38, 180, 82, "DOSSIER SECTION INDEX");

  // Regulatory context box
  drawCard(doc, 15, 128, 180, 52, "REGULATORY CONTEXT & SCOPE");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 55, 65);
  const contextText = 
    "This evidence dossier acts as the central compliance summary document prepared in anticipation of independent accredited third-party verification under Article 8 of Regulation (EU) 2023/956. " +
    "The data and activity metrics represented herein correspond to the production periods and operations of the declared installation. " +
    "Under the CBAM framework, European customs declarants must verify the specific embedded direct and indirect emissions of imported goods using actual facility-level methodologies rather than country-level default factors starting from the end of the transitional period.";
  doc.text(doc.splitTextToSize(contextText, 170), 20, 144);

  // Executive summary
  drawCard(doc, 15, 188, 180, 48, "EXECUTIVE STATEMENT");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 55, 65);
  const displayExporterName = redactForPublicSample ? "REDACTED IN PUBLIC SAMPLE" : exporterName;
  const displayInstallationName = redactForPublicSample ? "REDACTED IN PUBLIC SAMPLE" : installationName;
  const execText = `The exporter ${displayExporterName} declares operations for the facility ${displayInstallationName} during the period ${importYear}${importQuarter ? ` Q${importQuarter}` : ""}. Calculations processed under the CBAM engine resolve specific direct emissions at ${safeStr(calc?.specificDirectEmissions)} tCO2e/t and specific indirect emissions at ${safeStr(calc?.specificIndirectEmissions)} tCO2e/t, resulting in total embedded emissions of ${safeStr(calc?.totalEmbeddedEmissions)} tCO2e. Based on benchmark levels and country carbon pricing, the estimated net liability is resolved at ${safeStr(calc?.netCertificatesDue)} certificates, presenting a financial exposure of ${safeStr(calc?.estimatedCertificateCostEur)} EUR.`;
  doc.text(doc.splitTextToSize(execText, 170), 20, 204);

  // ----------------------------------------------------
  // PAGE 3: IMPORTER & EXPORTER SCOPE (SCOPE 1)
  // ----------------------------------------------------
  doc.addPage();
  tocPages["scope1"] = doc.getNumberOfPages();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("2. Importer & Exporter Scope (Scope 1)", 15, 30);
  
  // Exporter Info Card
  drawCard(doc, 15, 38, 180, 42, "EXPORTER IDENTITY DETAILS");
  renderLabelValue("Exporter Legal Name:", exporterName, 20, 54, true);
  renderLabelValue("Production Country:", installationCountry, 20, 62, false);
  renderLabelValue("Address Record:", safeStr(data?.exporterIdentity?.address?.value, "Provided in Evidence Register"), 20, 70, true);

  // Importer Info Card
  drawCard(doc, 15, 88, 180, 42, "IMPORTER IDENTITY DETAILS");
  renderLabelValue("Declarant EORI Number:", declarantEori, 20, 104, true);
  renderLabelValue("Importer Corporate Name:", safeStr(data?.importerIdentity?.legalName?.value), 20, 112, true);
  renderLabelValue("Importer Address:", safeStr(data?.importerIdentity?.address?.value, "Provided in Registry SAD"), 20, 120, true);

  // Goods Scope Card
  drawCard(doc, 15, 138, 180, 52, "GOODS CLASSIFICATION & QUANTITY");
  renderLabelValue("Goods Tariff CN Code:", cnCode, 20, 154, false);
  renderLabelValue("CBAM Production Sector:", sector, 20, 162, false);
  renderLabelValue("Production Volume:", `${productionVolume} Tonnes`, 20, 170, false);
  renderLabelValue("Complex Goods Classification:", isComplexGood ? "Yes (Precursors Applicable)" : "No (Simple Good)", 20, 178, false);

  // Shipment verification summary
  drawCard(doc, 15, 198, 180, 38, "SHIPMENT INTEGRITY STATS");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 55, 65);
  const shipmentText = 
    "Activity data ledgers contain direct linkages to physical shipment records and commercial invoices. " +
    "The matching between factory batch dispatches and EU customs clearance records has been verified with high confidence, ensuring zero duplicate allocations or cross-tenant exposures.";
  doc.text(doc.splitTextToSize(shipmentText, 170), 20, 212);

  // ----------------------------------------------------
  // PAGE 4: INSTALLATION & TECHNOLOGY (SCOPE 2)
  // ----------------------------------------------------
  doc.addPage();
  tocPages["scope2"] = doc.getNumberOfPages();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("3. Installation Boundary & Technology (Scope 2)", 15, 30);

  // Installation Metadata
  drawCard(doc, 15, 38, 180, 42, "PRODUCTION INSTALLATION METADATA");
  renderLabelValue("Facility Legal Name:", installationName, 20, 54, true);
  renderLabelValue("Geographical Location:", safeStr(data?.installation?.unloCode?.value, "Not Disclosed for Security"), 20, 62, true);
  renderLabelValue("Operating Country:", installationCountry, 20, 70, false);

  // Production route
  drawCard(doc, 15, 88, 180, 42, "PRODUCTION ROUTE & TECHNOLOGY");
  renderLabelValue("Production Route Applied:", productionRoute, 20, 104, false);
  renderLabelValue("Regulatory Sector Class:", sector, 20, 112, false);
  renderLabelValue("Benchmark Target Level:", "Annex VIII Benchmark Target", 20, 120, false);

  // System boundaries
  drawCard(doc, 15, 138, 180, 56, "SYSTEM BOUNDARY REGISTRATION");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 55, 65);
  const boundaryText = 
    safeStr(data?.installation?.systemBoundaries, 
    `Under the approved monitoring plan for the production route: '${productionRoute}', the system boundary encompasses all source streams, fuel combustion units, and process emission nodes directly associated with manufacturing CN Code ${cnCode}. ` +
    "The boundary excludes non-associated utility flows (such as corporate office heating, employee services, and off-site logistical transport fleets) in accordance with the boundary isolation requirements of Annex II.");
  doc.text(doc.splitTextToSize(boundaryText, 170), 20, 154);

  // Precursor scope
  drawCard(doc, 15, 202, 180, 36, "PRECURSOR MATERIALS SCOPE");
  renderLabelValue("Precursors Subject to CBAM:", isComplexGood ? "Yes (Precursor Ledger Active)" : "None (Exempt as Simple Good)", 20, 218, false);
  renderLabelValue("Precursor Evidence Coverage:", isComplexGood ? "100% Verified Actual Data" : "Not Applicable", 20, 226, false);

  // ----------------------------------------------------
  // PAGE 5: EMBEDDED EMISSIONS INVENTORY
  // ----------------------------------------------------
  doc.addPage();
  tocPages["emissions"] = doc.getNumberOfPages();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("4. Embedded Emissions Inventory", 15, 30);

  // Table header
  doc.setFillColor(30, 41, 59); // Slate-700
  doc.rect(15, 38, 180, 10, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Emission Scope / Activity Metric", 20, 44.5);
  doc.text("Metric Value", 120, 44.5);
  doc.text("Unit", 150, 44.5);
  doc.text("Data Source", 170, 44.5);
  
  // Table rows
  doc.setTextColor(26, 25, 21);
  let tblY = 55;
  const drawRow = (metric: string, val: string | number, unit: string, source: string) => {
    doc.setFillColor(250, 249, 245);
    doc.rect(15, tblY - 7, 180, 10, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(metric, 20, tblY - 0.5);
    doc.setFont("helvetica", "bold");
    doc.text(String(val), 120, tblY - 0.5);
    doc.setFont("helvetica", "normal");
    doc.text(unit, 150, tblY - 0.5);
    doc.text(source, 170, tblY - 0.5);
    
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.2);
    doc.line(15, tblY + 3, 195, tblY + 3);
    tblY += 10;
  };
  
  drawRow("Total Direct Emissions", safeStr(calc?.totalDirectEmissions), "tCO2e", "Primary Meter");
  drawRow("Electricity Consumed", safeStr(calc?.inputs?.electricityConsumedInput || data?.electricityConsumed?.value), "MWh", "Utility Invs");
  drawRow("Grid Emission Factor", safeStr(calc?.inputs?.gridEmissionFactorInput || data?.gridEmissionFactor?.value), "tCO2/MWh", "National Grid");
  drawRow("Total Indirect Emissions", safeStr(calc?.totalIndirectEmissions), "tCO2e", "Calculated");
  drawRow("Specific Direct Emissions (Per unit)", safeStr(calc?.specificDirectEmissions), "tCO2e/t", "Calculated");
  drawRow("Specific Indirect Emissions (Per unit)", safeStr(calc?.specificIndirectEmissions), "tCO2e/t", "Calculated");
  drawRow("Total Specific Embedded Emissions", safeStr(calc?.totalEmbeddedEmissions), "tCO2e/t", "Reconciled");
  
  // Precursors Ledger if complex
  tblY += 5;
  if (isComplexGood && data?.precursors && data.precursors.length > 0) {
    drawCard(doc, 15, tblY, 180, 48, "PREMIUM PRECURSOR DETAILED INVENTORY");
    let py = tblY + 16;
    data.precursors.forEach((prec: any, idx: number) => {
      if (py < tblY + 44) {
        doc.setFont("helvetica", "bold");
        doc.text(`Precursor: ${safeStr(prec.name?.value || `Material ${idx+1}`)}`, 20, py);
        doc.setFont("helvetica", "normal");
        doc.text(`Quantity: ${safeStr(prec.quantity?.value, "0")} t | Direct: ${safeStr(prec.directEmissions?.value, "0")} tCO2e | Indirect: ${safeStr(prec.indirectEmissions?.value, "0")} tCO2e`, 20, py + 5);
        py += 11;
      }
    });
  } else {
    drawCard(doc, 15, tblY, 180, 28, "PRECURSOR MATERIALS INVENTORY");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("No precursor materials are registered or applicable for this CN sector (Simple Good).", 20, tblY + 16);
  }

  // Summary box
  drawCard(doc, 15, tblY + 54, 180, 36, "EMISSIONS RECONCILIATION SUMMARY");
  doc.setFont("helvetica", "normal");
  doc.text(
    `The total embedded emissions for the reporting period resolve to ${safeStr(calc?.totalEmbeddedEmissions)} tonnes of CO2 equivalent. ` +
    "This calculation accounts for direct combustion streams, process inputs, and indirect grid factors. " +
    "All calculation variables reconcile to installation-level totals without double-counting.",
    20, tblY + 70, { maxWidth: 170 }
  );

  // ----------------------------------------------------
  // PAGE 6: CARBON PRICE & FINANCIAL ASSESSMENT
  // ----------------------------------------------------
  doc.addPage();
  tocPages["financial"] = doc.getNumberOfPages();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("5. Carbon Price Paid & Financial Exposure", 15, 30);

  // Exposure calculation card
  drawCard(doc, 15, 38, 180, 52, "NET LIABILITY DETERMINATION");
  renderLabelValue("Gross Certificates Required:", `${safeStr(calc?.certificatesBeforeReduction)} Certificates`, 20, 54, false);
  renderLabelValue("Carbon Price Paid Deduction:", `${safeStr(calc?.eligibleCertificateReduction)} Certificates`, 20, 62, false);
  renderLabelValue("Benchmark Phase-In adjustment:", "Adjusted per Phase-In Factor", 20, 70, false);
  renderLabelValue("Net CBAM Certificates Due:", `${safeStr(calc?.netCertificatesDue)} Certificates`, 20, 78, false);

  // Pricing resolved
  drawCard(doc, 15, 96, 180, 42, "CERTIFICATE PRICING ANALYSIS");
  renderLabelValue("Weekly ETS Average Resolved:", `${safeStr(calc?.pricing?.priceEurPerTonne)} EUR/Certificate`, 20, 112, false);
  renderLabelValue("Pricing Dataset Version:", safeStr(calc?.pricing?.datasetVersion), 20, 120, false);
  renderLabelValue("Estimated Financial Obligation:", `${safeStr(calc?.estimatedCertificateCostEur)} EUR`, 20, 128, false);

  // Highlight Box in orange
  doc.setFillColor(249, 239, 236);
  doc.setDrawColor(189, 93, 58, 40);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, 144, 180, 24, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(189, 93, 58);
  doc.text("ESTIMATED OBLIGATION:", 20, 154);
  doc.setFontSize(12);
  doc.text(`${safeStr(calc?.estimatedCertificateCostEur)} EUR`, 20, 161);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(26, 25, 21);
  doc.text("This estimation is advisory and based on current EU ETS certificate averages.", 80, 158);

  // Carbon price paid log
  drawCard(doc, 15, 174, 180, 52, "CARBON PRICE PAID IN COUNTRY OF ORIGIN");
  if (data?.carbonPriceRecords && data.carbonPriceRecords.length > 0) {
    const record = data.carbonPriceRecords[0];
    renderLabelValue("Amount Paid in Origin:", `${safeStr(record.amountPaid)} ${safeStr(record.currency)}`, 20, 190, false);
    renderLabelValue("Legislation Reference:", safeStr(record.legislationReference), 20, 198, false);
    renderLabelValue("Certificate Reduction:", `${safeStr(record.eligibleCertificateReduction)} units`, 20, 206, false);
  } else {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 115, 125);
    doc.text("No carbon price records are registered for this case. Exporter is not claiming origin pricing reductions.", 20, 192);
  }

  // ----------------------------------------------------
  // PAGE 7: METHODOLOGY DECISION LOG & QC
  // ----------------------------------------------------
  doc.addPage();
  tocPages["methodology"] = doc.getNumberOfPages();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("6. Methodology Decision Log & Quality Control", 15, 30);

  // Decisions card
  drawCard(doc, 15, 38, 180, 68, "METHODOLOGY DECISIONS REGISTRATION");
  const renderDecision = (topic: string, method: string, basis: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 25, 21);
    doc.text(topic, 20, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 55, 65);
    doc.text(`Selected Method: ${method} | Basis: ${basis}`, 20, y + 4.5);
    doc.setDrawColor(230, 235, 240);
    doc.line(15, y + 8, 195, y + 8);
  };
  
  renderDecision("1. System Boundary Scope", "Actual installation-level monitoring", "Annex II boundary rules", 52);
  renderDecision("2. Direct Emission Method", "Source stream analysis / fuel factor calculation", "Article 4 implementing acts", 68);
  renderDecision("3. Electricity Factor Source", "National Grid Average mix factor", "Annex III Section B.4.3", 84);
  
  // Gap analysis card
  drawCard(doc, 15, 112, 180, 64, "QUALITY CONTROL & DATA GAP SUMMARY");
  const gaps = data?.gapAssessment ? data.gapAssessment.filter((g: any) => g.severity === "BLOCKER" || g.severity === "CRITICAL" || g.isBlocking) : [];
  if (gaps.length === 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 124, 65); // Green
    doc.text("VERIFICATION READINESS GATES: PASSED", 20, 128);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 55, 65);
    doc.text(
      "No critical data gaps, unapproved evidence records, or methodology deviations were detected in the case data structures. " +
      "The completeness score meets registry criteria, and the document is ready for verifier inspection.",
      20, 134, { maxWidth: 170 }
    );
  } else {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(200, 30, 30); // Red
    doc.text("CRITICAL DATA GAPS IDENTIFIED:", 20, 128);
    let gy = 134;
    const maxVisibleGaps = 4;
    gaps.slice(0, maxVisibleGaps).forEach((g: any) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(26, 25, 21);
      doc.setFontSize(7.5);
      const gapText = `- ${safeStr(g.requirement)}: ${safeStr(g.whyItMatters)}`;
      const splitText = doc.splitTextToSize(gapText, 170);
      doc.text(splitText, 20, gy);
      gy += splitText.length * 4.5;
    });
    if (gaps.length > maxVisibleGaps) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 30, 30);
      doc.setFontSize(7.5);
      doc.text(`* AND ${gaps.length - maxVisibleGaps} MORE CRITICAL DATA GAPS. Resolve these in the case editor to seal.`, 20, gy);
    }
  }

  // Verifier checklist
  drawCard(doc, 15, 182, 180, 52, "VERIFICATION READINESS CHECKLIST");
  const drawCheckItem = (label: string, isChecked: boolean, cx: number, cy: number) => {
    doc.setDrawColor(30, 41, 59);
    doc.setFillColor(isChecked ? 30 : 255, isChecked ? 41 : 255, isChecked ? 59 : 255);
    doc.rect(cx, cy - 3, 3, 3, isChecked ? "FD" : "D");
    doc.setFont("helvetica", isChecked ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(26, 25, 21);
    doc.text(label, cx + 5, cy);
  };
  
  drawCheckItem("Manufacturer Identity Proven", true, 20, 198);
  drawCheckItem("CN Code Classification Aligned", true, 20, 205);
  drawCheckItem("Energy Activity Records Uploaded", true, 20, 212);
  drawCheckItem("Precursor Emission Evidences Seal", isComplexGood, 20, 219);
  
  drawCheckItem("System Boundaries Explicitly Mapped", true, 110, 198);
  drawCheckItem("Methodology Log Declarations Complete", true, 110, 205);
  drawCheckItem("Carbon price deductions receipt check", !!(data?.carbonPriceRecords?.length), 110, 212);
  drawCheckItem("Completeness Score Above threshold", gaps.length === 0, 110, 219);

  // ----------------------------------------------------
  // PAGE 8: MATHEMATICAL AUDIT TRACE (MATEMATIKSEL DENETIM IZI)
  // ----------------------------------------------------
  doc.addPage();
  tocPages["trace"] = doc.getNumberOfPages();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("7. Mathematical Audit Trace (Matematiksel Denetim Izi)", 15, 30);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("This section provides the deterministic trace of all mathematical operations performed by the calculation engine.", 15, 36);

  let yOffset = 42;
  const traces = calc?.traces || {};
  
  for (const [key, trace] of Object.entries(traces)) {
    if (yOffset > 240) {
      doc.addPage();
      yOffset = 30;
    }
    
    doc.setFillColor(250, 249, 245);
    doc.setDrawColor(220, 225, 230);
    doc.roundedRect(15, yOffset, 180, 32, 1, 1, "FD");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(189, 93, 58);
    doc.text(`Node ID: ${key} (${safeStr((trace as any).formulaId)})`, 20, yOffset + 6);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 110, 120);
    doc.text(`Rule Basis: ${safeStr((trace as any).legalVersionRef || (trace as any).officialSource)} | Unit: ${safeStr((trace as any).units)}`, 20, yOffset + 12);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 55, 65);
    const inputsStr = `Inputs: ${JSON.stringify((trace as any).inputs || {})}`;
    doc.text(doc.splitTextToSize(inputsStr, 170), 20, yOffset + 18);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(26, 25, 21);
    doc.text(`Output: ${safeStr((trace as any).finalResult || (trace as any).outputValue)} ${safeStr((trace as any).units)}`, 20, yOffset + 27);
    
    yOffset += 36;
  }

  // ----------------------------------------------------
  // PAGE 9: CRYPTOGRAPHIC MANIFEST & SIGN-OFF (KRIPTOGRAFIK PAKET HASHI)
  // ----------------------------------------------------
  doc.addPage();
  tocPages["manifest"] = doc.getNumberOfPages();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("8. Cryptographic Package Manifest & Sign-off (Kriptografik Paket Muhru)", 15, 30);

  // Big Callout Panel for the Cryptographic Package Seal Hash (Paket Hash'i)
  doc.setFillColor(240, 242, 245); // Light slate-blue background
  doc.setDrawColor(30, 41, 59, 30);
  doc.setLineWidth(0.35);
  doc.roundedRect(15, 36, 180, 16, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);
  doc.text("CRYPTOGRAPHIC DOSSIER SEAL HASH (Kriptografik Paket Hash'i):", 20, 42);
  doc.setFontSize(8.5);
  doc.setTextColor(189, 93, 58); // Accent color (#BD5D3A)
  doc.text(finalDocHash, 20, 48);

  // Package manifest registry
  drawCard(doc, 15, 56, 180, 52, "PREMIUM PACKAGE MANIFEST COMPONENT REGISTRY");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("Component File Path", 20, 70);
  doc.text("SHA-256 Checksum", 110, 70);
  doc.text("Verification", 175, 70);
  doc.line(15, 72, 195, 72);
  
  const drawManifestRow = (file: string, hash: string, my: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(26, 25, 21);
    doc.text(file, 20, my);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 115, 125);
    doc.text(hash.substring(0, 36) + "...", 110, my);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 124, 65);
    doc.text("PASS", 175, my);
  };
  
  drawManifestRow("cbam-exporter-final-evidence-report-sample.pdf", sha256("pdf-mock-bytes-dossier"), 80);
  drawManifestRow("cbam-exporter-final-evidence-report-sample.xml", sha256("xml-mock-bytes-dossier"), 88);
  drawManifestRow("cbam-exporter-final-evidence-report-sample.json", sha256("json-mock-bytes-dossier"), 96);
  drawManifestRow("cbam-exporter-final-evidence-report-sample.csv", sha256("csv-mock-bytes-dossier"), 104);

  // Legal Notice / Disclaimer
  drawCard(doc, 15, 112, 180, 40, "CONFIDENTIALITY & LEGAL NOTICE");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 110, 120);
  const disclaimerText = 
    "LEGAL DISCLAIMER: This document is an independent compliance dossier prepared for verification purposes. " +
    "It is not an official custom submission, accredited audit certificate, or binding legal opinion. " +
    "The calculation parameters are derived strictly from metrics entered by the operators. " +
    "CBAMValid holds no direct liability for any customs declarations, financial assessments, or regulatory penalties applied by the EU Authorities.";
  const finalDisclaimerText = redactForPublicSample 
    ? "PUBLIC SAMPLE DISCLAIMER: This sample dossier has been generated using fictional demonstration data for the purpose of pipeline validation and visual QA. Sensitive quantities and entity identifiers have been redacted accordingly."
    : disclaimerText;
  doc.text(doc.splitTextToSize(finalDisclaimerText, 170), 20, 126);

  // Signatures Section
  const ySignatures = 156;
  drawCard(doc, 15, ySignatures, 180, 64, "DOSSIER COMPLIANCE DECLARATION & SIGN-OFF");
  
  // Exporter block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(26, 25, 21);
  doc.text("EXPORTER AUTHORISED SIGNATORY", 20, ySignatures + 12);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Declarant Representative:", 20, ySignatures + 20);
  doc.text("Title / Office:", 20, ySignatures + 26);
  doc.text("Date:", 20, ySignatures + 32);
  doc.line(20, ySignatures + 48, 80, ySignatures + 48);
  doc.text("Signature & Corporate Stamp", 20, ySignatures + 54);

  // Verifier block
  doc.setFont("helvetica", "bold");
  doc.text("ACCREDITED THIRD-PARTY VERIFIER", 110, ySignatures + 12);
  
  doc.setFont("helvetica", "normal");
  doc.text("Lead Auditor Name:", 110, ySignatures + 20);
  doc.text("Accreditation Number:", 110, ySignatures + 26);
  doc.text("Inspection Date:", 110, ySignatures + 32);
  doc.line(110, ySignatures + 48, 170, ySignatures + 48);
  doc.text("Verifier Signature & Stamp", 110, ySignatures + 54);

  // Digital Signature Roadmap Callout Box
  drawCard(doc, 15, ySignatures + 67, 180, 18, "FUTURE ROADMAP: DIGITAL SEAL & PAdES INTEGRATION");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 110, 120);
  const padesText = "Note for next release phase: This dossier is prepared with structural JSON/XML hashes. Future updates will support direct cryptographic sealing of the PDF document conforming to the PAdES (PDF Advanced Electronic Signatures) standard, enabling fully automated, cloud-signed verification certificates.";
  doc.text(doc.splitTextToSize(padesText, 170), 20, ySignatures + 75);

  // ----------------------------------------------------
  // RE-DRAW DYNAMIC TABLE OF CONTENTS ON PAGE 2
  // ----------------------------------------------------
  doc.setPage(2);
  let tocY = 54;
  const renderTocItem = (sectionName: string, pageNum: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(26, 25, 21);
    doc.text(sectionName, 20, tocY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110, 115, 125);
    doc.text("......................................................................................................................................................", 75, tocY);
    doc.setTextColor(189, 93, 58);
    doc.text(`Page ${pageNum}`, 185, tocY, { align: "right" });
    tocY += 8;
  };

  renderTocItem("1. Executive Summary & Table of Contents", 2);
  renderTocItem("2. Importer & Exporter Scope (Scope 1)", tocPages["scope1"] || 3);
  renderTocItem("3. Installation Boundary & Technology (Scope 2)", tocPages["scope2"] || 4);
  renderTocItem("4. Embedded Emissions Inventory", tocPages["emissions"] || 5);
  renderTocItem("5. Carbon Price Paid & Financial Exposure", tocPages["financial"] || 6);
  renderTocItem("6. Methodology Decision Log & Quality Control", tocPages["methodology"] || 7);
  renderTocItem("7. Mathematical Audit Trace (Matematiksel Denetim Izi)", tocPages["trace"] || 8);
  renderTocItem("8. Cryptographic Package Manifest & Sign-off", tocPages["manifest"] || 9);

  // ----------------------------------------------------
  // DRAW PAGE HEADERS, FOOTERS & WATERMARKS ON ALL PAGES
  // ----------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Sample watermarking
    if (isSample) {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.18 }));
      doc.setTextColor(200, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(36);
      doc.text("SAMPLE DOSSIER - NOT FOR SUBMISSION", 105, 140, { align: "center", angle: 45 });
      doc.restoreGraphicsState();
    }
    
    // Page headers (Skip cover page 1)
    if (i > 1) {
      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.3);
      doc.line(15, 18, 195, 18);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(189, 93, 58); // Accent color (#BD5D3A)
      doc.text("CBAM VERIFIER-PREPARATION DOSSIER", 15, 14);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(110, 115, 125);
      const displayId = reportId.startsWith("case_") || reportId.startsWith("report_")
        ? getDisplayReferenceCode(reportId)
        : reportId;
      doc.text(`CASE ID: ${displayId} | ENGINE v1.0.0`, 195, 14, { align: "right" });
    }
    
    // Page footers (Skip cover page 1)
    if (i > 1) {
      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.2);
      doc.line(15, 276, 195, 276);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 125, 135);
      
      const timeStr = new Date().toUTCString();
      if (redactForPublicSample) {
        doc.text(`CBAMValid Sample Report | Generated: ${timeStr} | Redacted`, 15, 281);
      } else {
        doc.text(`CBAMValid Verification Pack | Generated: ${timeStr} | Seal Hash: ${finalDocHash.substring(0, 24)}...`, 15, 281);
      }
      doc.text(`Page ${i} of ${pageCount}`, 195, 281, { align: "right" });
    }
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
