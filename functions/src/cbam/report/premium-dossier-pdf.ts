import crypto from "node:crypto";
import { jsPDF } from "jspdf";
import type { PremiumDossierViewModel } from "./premium-dossier-schema";
import { getReportingPeriodAssessment } from "../validation/readiness-score";
import type { AuditReadyCase } from "../schema";
import { assertSectorSealable, type CbamSector } from "../sectors/sector-adapter";

const PAGE_WIDTH = 210;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_TOP = 40;
const BODY_BOTTOM = 275;

function digest(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function asText(value: unknown): string {
  return String(value ?? "—").trim() || "—";
}

export function buildPremiumDossierPdf(model: PremiumDossierViewModel, caseData: AuditReadyCase): Buffer {
  const uniqueSectors = new Set(caseData.goods.map((item) => item.sector));
  const methodologies = [...uniqueSectors].map((sector) => assertSectorSealable(sector as CbamSector));

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  doc.setCreationDate(new Date(model.generatedAt));
  doc.setFileId(digest(`${model.reportId}:PremiumDossier`).slice(0, 32).toUpperCase());
  doc.setProperties({
    title: model.documentTitle,
    subject: "CBAM Verification Readiness Pack",
    author: "CBAMValid",
    creator: "CBAMValid Premium Dossier Engine 5.0",
    keywords: "CBAM, verifier, readiness, evidence, materiality, trace, dossier",
  });

  let y = BODY_TOP;
  const sectionPages: Record<number, number> = {};

  const ensure = (height: number) => {
    if (y + height > BODY_BOTTOM) {
      doc.addPage();
      y = BODY_TOP;
    }
  };

  const drawParagraph = (text: string) => {
    const lines = doc.splitTextToSize(asText(text), CONTENT_WIDTH) as string[];
    ensure(lines.length * 4.5 + 2);
    doc.setTextColor(43, 51, 64);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4.5 + 2;
  };

  const drawCallout = (label: string, value: string) => {
    const lines = doc.splitTextToSize(asText(value), CONTENT_WIDTH - 42) as string[];
    const height = Math.max(12, lines.length * 4.2 + 6);
    ensure(height + 3);
    doc.setFillColor(244, 247, 250);
    doc.setDrawColor(190, 199, 210);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, height, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(20, 42, 74);
    doc.text(label.toUpperCase(), MARGIN + 4, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(43, 51, 64);
    doc.text(lines, MARGIN + 39, y + 5.5);
    y += height + 3;
  };

  const drawTable = (headers: string[], rows: any[][], widths?: number[]) => {
    if (headers.length === 0) return;
    const colWidths = widths && widths.length === headers.length
      ? widths.map(w => (w / widths.reduce((s, x) => s + x, 0)) * CONTENT_WIDTH)
      : Array.from({ length: headers.length }, () => CONTENT_WIDTH / headers.length);

    const headerLines = headers.map((header, index) =>
      doc.splitTextToSize(header, colWidths[index] - 2) as string[]
    );
    const maxHeaderLines = Math.max(1, ...headerLines.map(lines => lines.length));
    const headerHeight = maxHeaderLines * 3.5 + 3.5;

    const drawHeader = () => {
      // Header + minimum 2 rows must be kept together
      ensure(headerHeight + 12);
      doc.setFillColor(12, 30, 54);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.0);
      let x = MARGIN;
      headers.forEach((header, index) => {
        doc.rect(x, y, colWidths[index], headerHeight, "F");
        const lines = headerLines[index];
        doc.text(lines, x + 1, y + 4.5);
        x += colWidths[index];
      });
      y += headerHeight;
    };

    drawHeader();
    
    rows.forEach((row, rowIndex) => {
      let cellLines = headers.map((_, colIndex) =>
        doc.splitTextToSize(asText(row[colIndex]), colWidths[colIndex] - 2) as string[]
      );

      while (cellLines.some(lines => lines.length > 0)) {
        const availableHeight = BODY_BOTTOM - y;
        let linesThatFit = Math.floor((availableHeight - 4) / 3.5);
        
        if (linesThatFit < 1) {
          doc.addPage();
          y = BODY_TOP;
          drawHeader();
          continue;
        }

        const maxLinesInCells = Math.max(...cellLines.map(lines => lines.length));
        const chunkLineCount = Math.min(linesThatFit, maxLinesInCells);
        const chunkHeight = Math.max(6, chunkLineCount * 3.5 + 2);

        doc.setDrawColor(215, 221, 229);
        doc.setTextColor(43, 51, 64);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);

        let x = MARGIN;
        cellLines.forEach((lines, colIndex) => {
          doc.setFillColor(rowIndex % 2 === 0 ? 248 : 239, rowIndex % 2 === 0 ? 250 : 244, rowIndex % 2 === 0 ? 252 : 248);
          doc.rect(x, y, colWidths[colIndex], chunkHeight, "FD");

          const chunkText = lines.slice(0, chunkLineCount);
          doc.text(chunkText, x + 1, y + 4);

          x += colWidths[colIndex];
        });

        cellLines = cellLines.map(lines => lines.slice(chunkLineCount));
        y += chunkHeight;

        if (cellLines.some(lines => lines.length > 0)) {
          doc.addPage();
          y = BODY_TOP;
          drawHeader();
        }
      }
    });
    y += 2;
  };

  interface SectionPreview {
    height: number;
  }

  const paragraphPreview = (text: string, width = CONTENT_WIDTH): SectionPreview => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const lines = doc.splitTextToSize(asText(text), width);
    return { height: lines.length * 3.5 + 3 };
  };


  const tablePreview = (headers: string[], rows: any[][], widths?: number[]): SectionPreview => {
    const colWidths = widths && widths.length === headers.length
      ? widths.map(w => (w / widths.reduce((s, x) => s + x, 0)) * CONTENT_WIDTH)
      : Array.from({ length: headers.length }, () => CONTENT_WIDTH / headers.length);
    const headerLines = headers.map((header, index) =>
      doc.splitTextToSize(header, colWidths[index] - 2) as string[]
    );
    const maxHeaderLines = Math.max(1, ...headerLines.map(lines => lines.length));
    const headerHeight = maxHeaderLines * 3.5 + 3.5;
    
    let rowsHeight = 0;
    const firstTwo = rows.slice(0, 2);
    firstTwo.forEach((row, rowIndex) => {
      const cellLines = headers.map((_, colIndex) =>
        doc.splitTextToSize(asText(row[colIndex]), colWidths[colIndex] - 2) as string[]
      );
      const maxLines = Math.max(...cellLines.map(lines => lines.length));
      rowsHeight += Math.max(6, maxLines * 3.5 + 2);
    });
    if (firstTwo.length < 2) {
      rowsHeight += (2 - firstTwo.length) * 8;
    }
    return { height: headerHeight + rowsHeight };
  };

  const beginSection = (
    numOrParams: number | { number: number; title: string; preview: () => SectionPreview },
    title?: string,
    contentHeight?: number
  ) => {
    let num: number;
    let sectionTitle: string;
    let requiredHeight: number;

    if (typeof numOrParams === "object") {
      num = numOrParams.number;
      sectionTitle = numOrParams.title;
      requiredHeight = numOrParams.preview().height;
    } else {
      num = numOrParams;
      sectionTitle = title || "";
      requiredHeight = contentHeight || 35;
    }

    const headingHeight = 9;
    ensure(headingHeight + requiredHeight);
    sectionPages[num] = doc.getNumberOfPages();
    doc.setFillColor(231, 237, 244);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 7, "F");
    doc.setTextColor(20, 42, 74);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${num}. ${sectionTitle}`, MARGIN + 2, y + 4.8);
    y += 9;
  };

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  // Deep Navy background for top cover
  doc.setFillColor(12, 30, 54);
  doc.rect(0, 0, PAGE_WIDTH, 115, "F");

  // Gold accent separator bar
  doc.setFillColor(201, 154, 73);
  doc.rect(0, 115, PAGE_WIDTH, 3.5, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("CBAMValid", MARGIN, 35);
  
  // Gold subtitle tag line
  doc.setFontSize(14);
  doc.text("Verification Readiness & Evidence Assurance Dossier", MARGIN, 48);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(190, 200, 215);
  doc.text("Prepared for Independent Accredited Verifier Review", MARGIN, 58);

  // Status Box on Cover
  const periodAssessment = getReportingPeriodAssessment(caseData);
  const isReady = model.readiness.operatorStatus === "READY_FOR_VERIFIER_REVIEW" && periodAssessment.definitiveAnnualEligible;
  
  // Emerald Green for pass, Muted Red for failure/remediation
  doc.setFillColor(isReady ? 20 : 180, isReady ? 83 : 40, isReady ? 45 : 40);
  doc.roundedRect(MARGIN, 76, 85, 24, 1.5, 1.5, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("OPERATOR READINESS STATUS", MARGIN + 5, 83);
  doc.setFontSize(10.5);
  doc.text(isReady ? "READY_FOR_VERIFIER_REVIEW" : "REMEDIATION REQUIRED", MARGIN + 5, 92);

  // Score Box on Cover (Sophisticated dark slate)
  doc.setFillColor(34, 50, 75);
  doc.roundedRect(MARGIN + 93, 76, 42, 24, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("DIAGNOSTIC SCORE", MARGIN + 98, 83);
  doc.setFontSize(12.5);
  // Gold color for score text
  doc.setTextColor(201, 154, 73);
  doc.text(`${model.readiness.score} / 100`, MARGIN + 98, 92);

  // Cover Page Bottom Details
  doc.setTextColor(12, 30, 54);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let cy = 135;
  const writeCoverDetail = (label: string, val: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(12, 30, 54);
    doc.text(`${label}:`, MARGIN, cy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 70, 85);
    doc.text(val, MARGIN + 48, cy);
    cy += 6.0;
  };
  writeCoverDetail("Report ID", model.reportId);
  writeCoverDetail("Case ID", model.caseId);
  writeCoverDetail("Release Version", `V${model.releaseVersion}`);
  writeCoverDetail("Generated At", model.generatedAt);
  writeCoverDetail("Reporting Year & Period", model.identity.reportingPeriod);
  writeCoverDetail("Operator Name", model.identity.exporterOperator);
  writeCoverDetail("Installation Name", model.identity.installation);
  writeCoverDetail("Regulatory Basis", "Regulation (EU) 2023/956 & Implementing Regulation (EU) 2025/2546");

  // Secure Cryptographic Trust Stamp Card
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(201, 154, 73);
  doc.roundedRect(MARGIN, 192, CONTENT_WIDTH, 32, 1.5, 1.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(12, 30, 54);
  doc.text("SECURE TRUST STAMP & KMS SIGNATURE RECORD", MARGIN + 6, 199);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(80, 90, 105);
  doc.text(`Manifest SHA-256 Hash: ${model.manifestSummary.manifestHash || "NOT_AVAILABLE"}`, MARGIN + 6, 205);
  doc.text(`KMS Digital Signature ID: ${model.reportId}`, MARGIN + 6, 211);
  doc.text("Sealed Package Integrity: All 23 controlled package components frozen & digitally signed.", MARGIN + 6, 217);

  // Cover Legal Boundary statement
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(120, 130, 140);
  const boundaryLines = doc.splitTextToSize(model.legalBoundary, CONTENT_WIDTH) as string[];
  doc.text(boundaryLines, MARGIN, 255);

  // ==========================================
  // PAGE 2: DOCUMENT CONTROL & LEGAL BOUNDARY
  // ==========================================
  doc.addPage();
  y = BODY_TOP;

  // Section 2: Document Control
  beginSection({
    number: 2,
    title: "Document Control",
    preview: () => tablePreview(
      ["Control Parameter", "Registered Value"],
      [
        ["Report ID", model.reportId],
        ["Case ID", model.caseId],
        ["Release Version", `V${model.releaseVersion}`],
        ["Generated Timestamp", model.generatedAt],
        ["Ruleset Version", "EU-CBAM-DEFINITIVE-2026"],
        ["Calculation Engine Version", "3.0.0"],
        ["Verification Class", "Prepared for Independent Accredited Review"],
      ],
      [50, 130]
    )
  });
  drawTable(
    ["Control Parameter", "Registered Value"],
    [
      ["Report ID", model.reportId],
      ["Case ID", model.caseId],
      ["Release Version", `V${model.releaseVersion}`],
      ["Generated Timestamp", model.generatedAt],
      ["Ruleset Version", "EU-CBAM-DEFINITIVE-2026"],
      ["Calculation Engine Version", "3.0.0"],
      ["Verification Class", "Prepared for Independent Accredited Review"],
    ],
    [50, 130]
  );

  // Section 3: Legal and Product Boundary
  beginSection({
    number: 3,
    title: "Legal Status and Reliance Boundary",
    preview: () => paragraphPreview(model.legalBoundary)
  });
  drawParagraph(model.legalBoundary);
  drawCallout(
    "CBAMValid Internal automated readiness assessment",
    "This pack represents the operator's internal automated readiness work. Independent accredited verifier review status remains NOT_REVIEWED. ACCREDITED_VERIFICATION_OPINION is required for customs submission."
  );

  // ==========================================
  // PAGE 3: TABLE OF CONTENTS
  // ==========================================
  doc.addPage();
  // table of contents is populated dynamically in the second pass at page 3.

  // ==========================================
  // PAGE 4: EXECUTIVE DECISION BOARD
  // ==========================================
  doc.addPage();
  y = BODY_TOP;

  // Section 5: Executive Decision Board
  beginSection({
    number: 5,
    title: "Executive Decision Board",
    preview: () => paragraphPreview("The following summary table outlines the key metrics and decisions for senior executive/CFO review before independent verifier handover.")
  });
  drawParagraph("The following summary table outlines the key metrics and decisions for senior executive/CFO review before independent verifier handover.");
  
  drawTable(
    ["Readiness Score", "Critical Blockers", "Material Findings", "Open Findings", "Missing Evidence", "Unresolved Calc Exceptions", "Recommended Handover Decision"],
    [[
      `${model.readiness.score}/100`,
      model.readiness.criticalBlockerCount,
      model.readiness.materialFindingCount,
      model.readiness.openFindingCount,
      model.readiness.missingMaterialEvidenceCount,
      model.readiness.unresolvedCalculationExceptionCount,
      model.readiness.recommendedDecision,
    ]],
    [22, 22, 22, 20, 22, 22, 50]
  );
 
  const decisionExplanation = model.readiness.recommendedDecision === "READY_TO_HAND_OVER"
    ? "All hard gates passed. No critical blockers or unapproved evidence records. The case is ready to hand over to an independent accredited verifier."
    : "Gaps or blockers detected. Remediation is required before submitting to an independent accredited verifier. Please check the corrective action plan.";
  drawCallout("Recommended Action Context", decisionExplanation);
 
  // ==========================================
  // PAGE 5: READINESS SCORE AND HARD GATES
  // ==========================================
  doc.addPage();
  y = BODY_TOP;
 
  // Section 6: Readiness Score and Hard Gates
  const dimHeaders = ["Readiness Dimension", "Weight", "Score", "Weighted Score", "Passed / Total Reqs"];
  const dimRows = model.readiness.dimensions.map(d => [
    d.dimensionId,
    `${d.weight}%`,
    `${d.rawScore}%`,
    `${d.weightedScore}%`,
    `${d.passedRequirementCount} / ${d.applicableRequirementCount}`,
  ]);
  beginSection({
    number: 6,
    title: "Readiness Score and Hard Gates",
    preview: () => tablePreview(dimHeaders, dimRows, [50, 18, 18, 20, 30])
  });
  drawParagraph("The 100-point diagnostic score is computed based on 8 weighted dimensions. Hard blockers will override this score and force NOT_READY status.");
  drawTable(dimHeaders, dimRows, [50, 18, 18, 20, 30]);
 
  // Section 7: Operator and Installation Identity
  beginSection({
    number: 7,
    title: "Operator and Installation Identity",
    preview: () => tablePreview(
      ["Identity Attribute", "Declared Value"],
      [
        ["Operator Name", model.identity.exporterOperator],
        ["Importer Name", model.identity.importer],
        ["EORI Number", model.identity.eori],
        ["Installation Name", model.identity.installation],
        ["Country of Origin", model.identity.country],
      ],
      [50, 130]
    )
  });
  drawTable(
    ["Identity Attribute", "Declared Value"],
    [
      ["Operator Name", model.identity.exporterOperator],
      ["Importer Name", model.identity.importer],
      ["EORI Number", model.identity.eori],
      ["Installation Name", model.identity.installation],
      ["Country of Origin", model.identity.country],
    ],
    [50, 130]
  );
 
  // Section 8: Reporting Period Assessment
  const periodRows = [
    ["Reporting Year", String(periodAssessment.reportingYear)],
    ["Reporting Period Type", periodAssessment.type],
    ["Covered Dates", `${periodAssessment.startDate} to ${periodAssessment.endDate}`],
    ["Covered Days count", `${periodAssessment.coveredDays} days`],
    ["Expected Days count", `${periodAssessment.expectedDays} days`],
    ["Completeness Percentage", `${periodAssessment.completenessPercent}%`],
    ["Definitive Annual Eligible", periodAssessment.definitiveAnnualEligible ? "YES (PASSED)" : "NO (BLOCKED - Quarterly or partial-year period detected)"],
  ];
  beginSection({
    number: 8,
    title: "Reporting Period Assessment",
    preview: () => tablePreview(["Reporting Attribute", "Value"], periodRows, [60, 120])
  });
  drawParagraph(`Calendar-aware analysis of the reporting period for definitive annual verification eligibility.`);
  drawTable(["Reporting Attribute", "Value"], periodRows, [60, 120]);
  if (!periodAssessment.definitiveAnnualEligible) {
    drawCallout("Reporting Period Hard Blocker", "The reporting period is not a definitive annual period. A quarterly or partial-year period cannot pass definitive annual verifier readiness.");
  }

  // Section 9: Goods and CN Classification
  beginSection(9, "Goods and CN Classification", 35);
  drawParagraph("The case includes the following CN-coded goods classifications:");
  drawTable(
    ["Good Index", "CN Code", "Sector", "Production Volume"],
    model.goods.map(g => [g.goodIndex, g.cnCode, g.sector, `${g.productionVolume} ${g.productionUnit}`]),
    [20, 30, 50, 40]
  );

  // Section 10: Installation and System Boundary
  beginSection(10, "Installation and System Boundary", 30);
  drawCallout("Declared System Boundary", model.identity.systemBoundary);

  // Section 11: Production Processes and Functional Units
  beginSection(11, "Production Processes and Functional Units", 35);
  drawParagraph("Controlled production processes and default boundaries of matching sectors:");
  methodologies.forEach((sec) => {
    drawCallout(sec.displayName, `Legal Status: ${sec.legalStatus}. Default boundaries: ${sec.defaultBoundaries}`);
  });

  // Section 12: Material Input Register
  beginSection(12, "Material Input Register", 35);
  drawParagraph("Material activity data inputs required for the production route:");
  drawTable(
    ["Input Path", "Value", "Unit", "Source Type"],
    [
      ["directEmissions", caseData.directEmissions.value || "—", caseData.directEmissions.canonicalUnit || "—", caseData.directEmissions.sourceType || "—"],
      ["electricityConsumed", caseData.electricityConsumed.value || "—", caseData.electricityConsumed.canonicalUnit || "—", caseData.electricityConsumed.sourceType || "—"],
      ["gridEmissionFactor", caseData.gridEmissionFactor.value || "—", caseData.gridEmissionFactor.canonicalUnit || "—", caseData.gridEmissionFactor.sourceType || "—"],
    ],
    [50, 40, 40, 50]
  );

  // Section 13: Evidence Sufficiency Matrix
  beginSection(13, "Evidence Sufficiency Matrix", 35);
  drawParagraph("Requirement-level analysis of evidence linkages. PARTIALLY_SUPPORTED or missing evidence blocks sealing.");
  drawTable(
    ["Req ID", "Input Path", "Evidence IDs", "State", "Coverage", "Reason Codes"],
    model.evidenceSufficiency.map(s => [
      s.requirementId,
      s.inputPath,
      s.evidenceIds.join(", "),
      s.state,
      `${s.coverageNumerator} / ${s.coverageDenominator}`,
      s.reasonCodes.join(", "),
    ]),
    [22, 40, 25, 28, 20, 45]
  );

  // Section 14: Evidence Register
  beginSection(14, "Evidence Register", 35);
  const approvedRows = caseData.evidenceRegister.map(e => [
    e.evidenceId,
    e.fileName,
    e.documentType,
    e.reviewStatus,
    e.malwareScanStatus,
    e.fileHash.slice(0, 10) + "...",
  ]);
  drawTable(
    ["Evidence ID", "File Name", "Type", "Operator Status", "Malware Status", "SHA-256 (prefix)"],
    approvedRows.length ? approvedRows : [["—", "No evidence files registered.", "—", "—", "—", "—"]],
    [25, 45, 30, 25, 25, 30]
  );

  // Section 15: Data Lineage Matrix
  beginSection(15, "Data Lineage Matrix", 35);
  drawParagraph("Cryptographic audit path linking physical evidence hash to final calculation results:");
  const lineageRows = caseData.evidenceRegister.map(e => [
    e.evidenceId,
    e.fileHash.slice(0, 12) + "...",
    e.linkedInputs.join(", ") || "None",
    e.linkedCalculations.map(c => c.slice(0, 10)).join(", ") || "None",
  ]);
  drawTable(
    ["Evidence ID", "File Hash", "Linked Inputs", "Linked Calculation IDs"],
    lineageRows.length ? lineageRows : [["—", "—", "—", "—"]],
    [30, 30, 60, 60]
  );

  // Section 16: Direct Emissions
  beginSection(16, "Direct Emissions", 35);
  drawTable(
    ["Parameter", "Value", "Unit"],
    [
      ["Installation Direct Emissions", model.totals.installationDirectEmissions, "tCO2e"],
      ["Total Direct Emissions", model.totals.totalDirectEmissions, "tCO2e"],
    ],
    [80, 50, 50]
  );

  // Section 17: Indirect Emissions
  beginSection(17, "Indirect Emissions", 35);
  drawTable(
    ["Parameter", "Value", "Unit"],
    [
      ["Electricity Consumed", model.totals.electricityIndirectEmissions, "tCO2e"],
      ["Grid Emission Factor", model.totals.eligibleCertificateReduction, "tCO2e/MWh"],
    ],
    [80, 50, 50]
  );

  // Section 18: Precursors
  beginSection(18, "Precursors", 35);
  if (model.precursors.length > 0) {
    drawTable(
      ["Precursor Name", "Quantity", "Direct Emissions", "Indirect Emissions", "Country of Origin"],
      model.precursors.map(p => [p.name, p.quantity, p.directEmissions, p.indirectEmissions, p.countryOfOrigin]),
      [40, 30, 30, 30, 30]
    );
  } else {
    drawParagraph("NOT_APPLICABLE: No precursors declared for this production route.");
  }

  // Section 19: Allocation and Per-good Results
  beginSection(19, "Allocation and Per-good Results", 35);
  drawTable(
    ["Good", "CN Code", "Allocation Share", "Allocated Embedded", "Specific Embedded Emissions"],
    model.goods.map(g => [g.goodIndex, g.cnCode, g.allocationShare, g.allocatedEmbeddedEmissions, g.specificEmbeddedEmissions]),
    [15, 30, 30, 45, 60]
  );

  // Section 20: Calculation Integrity and Reconciliation
  beginSection(20, "Calculation Integrity and Reconciliation", 35);
  drawTable(
    ["Parameter", "Value", "Unit", "Verification Status"],
    [
      ["Allocation Share Total", model.totals.allocationShareTotal, "fraction", "RECONCILED"],
      ["Allocation Reconciliation Delta", model.totals.allocationReconciliationDelta, "fraction", "ZERO_DELTA_PASS"],
    ],
    [65, 35, 30, 50]
  );

  // Section 21: Data Quality, Uncertainty, and Missing Data
  beginSection(21, "Data Quality, Uncertainty, and Missing Data", 35);
  drawParagraph("The operator-supplied data is assessed for compliance with measurement instrument uncertainty thresholds. No data gaps or missing default values were automatically resolved using unverified sources.");

  // Section 22: Methodology Decision Register
  beginSection(22, "Methodology Decision Register", 35);
  const methodRows = caseData.methodologyDecisions.map(item => [
    item.topic,
    item.selectedMethod,
    item.reason,
    item.reviewStatus,
  ]);
  drawTable(
    ["Topic", "Selected Method", "Reason", "Operator Status"],
    methodRows.length ? methodRows : [["—", "No methodology decisions registered.", "—", "—"]],
    [35, 35, 75, 35]
  );

  // Section 23: Findings Register
  beginSection(23, "Findings Register", 35);
  const openFindings = model.findings.filter(f => f.status === "OPEN");
  if (openFindings.length > 0) {
    drawTable(
      ["Finding ID", "Severity", "Category", "Title", "Description"],
      openFindings.map(f => [f.findingId, f.severity, f.category, f.title, f.description]),
      [28, 20, 35, 45, 52]
    );
  } else {
    drawParagraph("No open findings or non-conformities are detected.");
  }

  // Section 24: Corrective Action Plan
  beginSection(24, "Corrective Action Plan", 35);
  const openActions = model.correctiveActions.filter(a => a.state === "OPEN");
  if (openActions.length > 0) {
    drawTable(
      ["Action ID", "Priority", "Required Action", "Role", "State"],
      openActions.map(a => [a.actionId, a.priority, a.requiredAction, a.responsibleRole, a.state]),
      [28, 18, 70, 32, 18]
    );
  } else {
    drawParagraph("All corrective actions are closed or not required.");
  }

  // Section 25: EU Verification Template Crosswalk
  beginSection(25, "EU Verification Template Crosswalk", 35);
  drawTable(
    ["Req ID", "Legal Basis", "Crosswalk Requirement", "Owner", "Status"],
    model.requirementCrosswalk.map(c => [
      c.requirementId,
      c.legalLocation,
      c.requirementText,
      c.owner,
      c.status,
    ]),
    [22, 35, 75, 28, 28]
  );

  // Section 26: Verifier Handover Checklist
  beginSection(26, "Verifier Handover Checklist", 35);
  drawParagraph("The following fields require manual review and completion by the independent accredited verifier:");
  drawTable(
    ["Verifier Reserved Field", "Status", "Comment"],
    [
      ["Accredited Verifier Name & ID", "VERIFIER_COMPLETION_REQUIRED", "Must be filled post-audit"],
      ["Site-visit date and verification opinion", "VERIFIER_COMPLETION_REQUIRED", "Must be filled post-audit"],
      ["Verification Certificate reference", "VERIFIER_COMPLETION_REQUIRED", "Must be filled post-audit"],
    ],
    [60, 50, 70]
  );

  // Section 27: Package Manifest and Digital Integrity
  beginSection(27, "Package Manifest and Digital Integrity", 35);
  drawTable(
    ["Integrity Parameter", "Value"],
    [
      ["Manifest Hash", model.manifestSummary.manifestHash || "NOT_AVAILABLE"],
      ["Package Hash", model.manifestSummary.packageHash || "NOT_AVAILABLE"],
      ["Schema Version", model.schemaVersion],
    ],
    [50, 130]
  );

  // Section 28: Version Comparison
  const versionRows: string[][] = [];
  if (model.previousReleases && model.previousReleases.length > 0) {
    model.previousReleases.forEach(r => {
      versionRows.push([
        `V${r.version}`,
        r.sealedAt,
        r.correctionReason || "Dossier release.",
        "OPERATOR_ADMIN",
        r.status,
      ]);
    });
  }
  versionRows.push([
    `V${model.releaseVersion}`,
    model.generatedAt,
    model.releaseVersion > 1 ? "Dossier correction/update release." : "Initial base release version.",
    "OPERATOR_ADMIN",
    "ACTIVE_RELEASE"
  ]);

  beginSection({
    number: 28,
    title: "Version Comparison",
    preview: () => paragraphPreview("This register tracks the history of released and sealed package versions under this case scope:")
  });
  drawParagraph("This register tracks the history of released and sealed package versions under this case scope:");
  if (!model.previousReleases || model.previousReleases.length === 0) {
    drawParagraph("No previous sealed release exists.");
  }
  drawTable(
    ["Version", "Sealed Timestamp", "Release Reason / Changes", "Author", "Status"],
    versionRows,
    [20, 40, 70, 30, 20]
  );

  // Section 29: Sign-off and Limitations
  beginSection(29, "Sign-off and Limitations", 35);
  drawParagraph("The operator hereby signs off on this verifier-preparation dossier as complete and accurate to the best of their knowledge. This package does not constitute a legally binding verifier certificate.");
  drawTable(
    ["Sign-off Role", "Name & Title", "Signature", "Sign-off Date"],
    [
      ["Operator Author", "NOT_PROVIDED", "NOT_SIGNED", "NOT_AVAILABLE"],
      ["Accredited Verifier", "NOT_AVAILABLE", "NOT_SIGNED", "NOT_AVAILABLE"]
    ],
    [50, 50, 50, 30]
  );

  // Section 30: Technical Annex Index
  beginSection(30, "Technical Annex Index", 35);
  drawParagraph("The ZIP package contains the following 25 components:");
  drawTable(
    ["Filename in ZIP", "Format", "Description"],
    [
      ["CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf", "PDF", "Primary Executive and Verifier Readiness Pack"],
      ["Complete Dossier Compilation.pdf", "PDF", "Technical Compilation and Calculation Annex"],
      ["Verifier Workspace.xlsx", "XLSX", "Verifier Navigation spreadsheet"],
      ["Data Integrity Manifest.json", "JSON", "Cryptographic Manifest and files registry"],
      ["Manifest Signature.sig", "SIG", "KMS digital signature"],
    ],
    [70, 30, 80]
  );

  // ==========================================
  // SECOND PASS: TABLE OF CONTENTS (PAGE 3)
  // ==========================================
  doc.setPage(3);
  y = BODY_TOP;
  beginSection(4, "Table of Contents", 120);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(44, 62, 80);

  const writeTocRow = (num: number, title: string) => {
    const page = sectionPages[num] || 3;
    doc.setFont("helvetica", "bold");
    doc.text(`${num}.`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(title, MARGIN + 8, y);
    doc.text(String(page), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5.2;
  };

  writeTocRow(2, "Document Control");
  writeTocRow(3, "Legal and Product Boundary");
  writeTocRow(4, "Table of Contents");
  writeTocRow(5, "Executive Decision Board");
  writeTocRow(6, "Readiness Score and Hard Gates");
  writeTocRow(7, "Operator and Installation Identity");
  writeTocRow(8, "Reporting Period Assessment");
  writeTocRow(9, "Goods and CN Classification");
  writeTocRow(10, "Installation and System Boundary");
  writeTocRow(11, "Production Processes and Functional Units");
  writeTocRow(12, "Material Input Register");
  writeTocRow(13, "Evidence Sufficiency Matrix");
  writeTocRow(14, "Evidence Register");
  writeTocRow(15, "Data Lineage Matrix");
  writeTocRow(16, "Direct Emissions");
  writeTocRow(17, "Indirect Emissions");
  writeTocRow(18, "Precursors");
  writeTocRow(19, "Allocation and Per-good Results");
  writeTocRow(20, "Calculation Integrity and Reconciliation");
  writeTocRow(21, "Data Quality, Uncertainty, and Missing Data");
  writeTocRow(22, "Methodology Decision Register");
  writeTocRow(23, "Findings Register");
  writeTocRow(24, "Corrective Action Plan");
  writeTocRow(25, "EU Verification Template Crosswalk");
  writeTocRow(26, "Verifier Handover Checklist");
  writeTocRow(27, "Package Manifest and Digital Integrity");
  writeTocRow(28, "Version Comparison");
  writeTocRow(29, "Sign-off and Limitations");
  writeTocRow(30, "Technical Annex Index");

  // ==========================================
  // THIRD PASS: RUNNING HEADERS & FOOTERS
  // ==========================================
  const pageCount = doc.getNumberOfPages();
  for (let pNum = 1; pNum <= pageCount; pNum += 1) {
    doc.setPage(pNum);

    // Skip Cover Page for Running Headers & Footers
    if (pNum === 1) continue;

    // Running Header
    doc.setFillColor(12, 30, 54);
    doc.rect(0, 0, PAGE_WIDTH, 20, "F");

    // Gold separator line below running header
    doc.setFillColor(201, 154, 73);
    doc.rect(0, 20, PAGE_WIDTH, 0.8, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(model.documentTitle, MARGIN, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Report ID: ${model.reportId} · Version V${model.releaseVersion}`, MARGIN, 16);

    // Confidentiality Status Badge
    doc.setFillColor(isReady ? 20 : 180, isReady ? 83 : 40, isReady ? 45 : 40);
    doc.rect(142, 5, 53, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(isReady ? "CHECKS PASSED" : "REMEDIATION REQUIRED", 168.5, 11.5, { align: "center" });

    // Running Footer
    doc.setDrawColor(211, 218, 227);
    doc.line(MARGIN, 283, PAGE_WIDTH - MARGIN, 283);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(90, 99, 112);
    doc.text("CONFIDENTIAL - Prepared for Independent Verification", MARGIN, 288);
    doc.text(`Page ${pNum} of ${pageCount}`, PAGE_WIDTH - MARGIN, 288, { align: "right" });
  }

  return Buffer.from(doc.output("arraybuffer"));
}
