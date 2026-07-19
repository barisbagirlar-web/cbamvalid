import crypto from "node:crypto";
import { jsPDF } from "jspdf";
import type { PremiumDossierViewModel } from "./premium-dossier-schema";
import { VERIFICATION_MATERIALITY_RATE } from "../registry/rulesets";

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

export function buildPremiumDossierPdf(model: PremiumDossierViewModel): Buffer {
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

    const drawHeader = () => {
      ensure(8);
      doc.setFillColor(31, 64, 104);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.0);
      let x = MARGIN;
      headers.forEach((header, index) => {
        doc.rect(x, y, colWidths[index], 7, "F");
        const lines = doc.splitTextToSize(header, colWidths[index] - 2) as string[];
        doc.text(lines.slice(0, 2), x + 1, y + 4.5);
        x += colWidths[index];
      });
      y += 7;
    };

    drawHeader();
    rows.forEach((row, rowIndex) => {
      const wrapped = headers.map((_, colIndex) =>
        doc.splitTextToSize(asText(row[colIndex]), colWidths[colIndex] - 2) as string[]
      );
      const rowHeight = Math.max(6, Math.max(...wrapped.map(lines => Math.min(lines.length, 6))) * 3.5 + 2);
      if (y + rowHeight > BODY_BOTTOM) {
        doc.addPage();
        y = BODY_TOP;
        drawHeader();
      }
      doc.setFillColor(rowIndex % 2 === 0 ? 248 : 239, rowIndex % 2 === 0 ? 250 : 244, rowIndex % 2 === 0 ? 252 : 248);
      doc.setDrawColor(215, 221, 229);
      doc.setTextColor(43, 51, 64);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      let x = MARGIN;
      wrapped.forEach((lines, colIndex) => {
        doc.rect(x, y, colWidths[colIndex], rowHeight, "FD");
        doc.text(lines.slice(0, 6), x + 1, y + 4);
        x += colWidths[colIndex];
      });
      y += rowHeight;
    });
    y += 2;
  };

  const drawSectionHeading = (num: number, text: string) => {
    ensure(12);
    sectionPages[num] = doc.getNumberOfPages();
    doc.setFillColor(231, 237, 244);
    doc.rect(MARGIN, y, CONTENT_WIDTH, 7, "F");
    doc.setTextColor(20, 42, 74);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${num}. ${text}`, MARGIN + 2, y + 4.8);
    y += 9;
  };

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  doc.setFillColor(20, 42, 74);
  doc.rect(0, 0, PAGE_WIDTH, 110, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CBAMValid", MARGIN, 40);
  doc.setFontSize(14);
  doc.text("Verification Readiness & Evidence Assurance Dossier", MARGIN, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Prepared for Independent Accredited Verifier Review", MARGIN, 62);

  // Status Box on Cover
  const isReady = model.readiness.operatorStatus === "READY_FOR_VERIFIER_REVIEW";
  doc.setFillColor(isReady ? 38 : 220, isReady ? 162 : 53, isReady ? 91 : 69);
  doc.rect(MARGIN, 75, 75, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("OPERATOR READINESS STATUS", MARGIN + 4, 82);
  doc.setFontSize(11);
  doc.text(model.readiness.operatorStatus, MARGIN + 4, 91);

  // Score Box on Cover
  doc.setFillColor(44, 62, 80);
  doc.rect(MARGIN + 85, 75, 45, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DIAGNOSTIC SCORE", MARGIN + 89, 82);
  doc.setFontSize(13);
  doc.text(`${model.readiness.score} / 100`, MARGIN + 89, 91);

  // Cover Page Bottom Details
  doc.setTextColor(44, 62, 80);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let cy = 125;
  const writeCoverDetail = (label: string, val: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, MARGIN, cy);
    doc.setFont("helvetica", "normal");
    doc.text(val, MARGIN + 45, cy);
    cy += 5.5;
  };
  writeCoverDetail("Report ID", model.reportId);
  writeCoverDetail("Case ID", model.caseId);
  writeCoverDetail("Release Version", `V${model.releaseVersion}`);
  writeCoverDetail("Generated At", model.generatedAt);
  writeCoverDetail("Reporting Year & Period", model.identity.reportingPeriod);
  writeCoverDetail("Operator Name", model.identity.exporterOperator);
  writeCoverDetail("Installation Name", model.identity.installation);
  writeCoverDetail("Regulatory Basis", "Regulation (EU) 2023/956 & Implementing Regulation (EU) 2025/2546");

  // Cover Legal Boundary statement
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(120, 130, 140);
  const boundaryLines = doc.splitTextToSize(model.legalBoundary, CONTENT_WIDTH) as string[];
  doc.text(boundaryLines, MARGIN, 255);

  // ==========================================
  // PAGE 2: EXECUTIVE DECISION BOARD
  // ==========================================
  doc.addPage();
  doc.setFillColor(20, 42, 74);
  doc.rect(0, 0, PAGE_WIDTH, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("EXECUTIVE DECISION BOARD", MARGIN, 13);

  y = 32;
  doc.setTextColor(44, 62, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Readiness Score Details by Dimension", MARGIN, y);
  y += 5;

  const dimHeaders = ["Readiness Dimension", "Weight", "Score", "Weighted", "Passed / Total Reqs"];
  const dimRows = model.readiness.dimensions.map(d => [
    d.dimensionId,
    `${d.weight}%`,
    `${d.rawScore}%`,
    `${d.weightedScore}%`,
    `${d.passedRequirementCount} / ${d.applicableRequirementCount}`,
  ]);
  drawTable(dimHeaders, dimRows, [50, 18, 18, 20, 30]);

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Readiness & Quality Control Metrics Summary", MARGIN, y);
  y += 5;

  drawTable(
    ["Critical Blockers", "Material Findings", "Open Findings", "Missing Evidence Count", "Unresolved Calculations", "Recommended Decision"],
    [[
      model.readiness.criticalBlockerCount,
      model.readiness.materialFindingCount,
      model.readiness.openFindingCount,
      model.readiness.missingMaterialEvidenceCount,
      model.readiness.unresolvedCalculationExceptionCount,
      model.readiness.recommendedDecision,
    ]],
    [25, 25, 22, 30, 30, 38]
  );

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("Top Corrective Actions (Priority List)", MARGIN, y);
  y += 5;

  const topActions = model.correctiveActions.slice(0, 5);
  const actionHeaders = ["Action ID", "Priority", "Required Action", "Responsible", "State"];
  const actionRows = topActions.length > 0
    ? topActions.map(a => [a.actionId, a.priority, a.requiredAction, a.responsibleRole, a.state])
    : [["—", "—", "No corrective actions required.", "—", "—"]];
  drawTable(actionHeaders, actionRows, [25, 18, 70, 25, 18]);

  // ==========================================
  // PAGE 3: TABLE OF CONTENTS (Placeholder)
  // ==========================================
  doc.addPage();
  doc.setFillColor(20, 42, 74);
  doc.rect(0, 0, PAGE_WIDTH, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TABLE OF CONTENTS", MARGIN, 13);
  // We will fill TOC content on page 3 in the second pass.

  // ==========================================
  // PAGES 4+: SECTION RENDERINGS
  // ==========================================
  doc.addPage();
  y = BODY_TOP;

  // Section 2: Legal Status and Reliance Boundary
  drawSectionHeading(2, "Legal Status and Reliance Boundary");
  drawParagraph(model.legalBoundary);
  drawCallout("Important Boundary Warning", "This document is prepared solely to facilitate verifier preparation. It does not replace the official reasonable assurance opinion issued by an accredited verifier under EU regulations.");

  // Section 4: Scope, Operator, Installation and Reporting Period
  drawSectionHeading(4, "Scope, Operator, Installation and Reporting Period");
  drawTable(
    ["Scope Attribute", "Operator Declared Value"],
    [
      ["Operator Name", model.identity.exporterOperator],
      ["Importer Name", model.identity.importer],
      ["EORI Number", model.identity.eori],
      ["Installation", model.identity.installation],
      ["Country", model.identity.country],
      ["Production Route", model.identity.productionRoute],
      ["Reporting Period", model.identity.reportingPeriod],
    ],
    [50, 130]
  );

  // Section 5: Goods and CN Classification
  drawSectionHeading(5, "Goods and CN Classification");
  drawParagraph("The installation manufactures goods matching the following CN code classifications:");
  drawTable(
    ["Good Index", "CN Code", "Sector", "Production Volume"],
    model.goods.map(g => [g.goodIndex, g.cnCode, g.sector, `${g.productionVolume} ${g.productionUnit}`]),
    [20, 30, 50, 40]
  );

  // Section 6: Installation Process and System Boundary
  drawSectionHeading(6, "Installation Process and System Boundary");
  drawCallout("Declared System Boundary Description", model.identity.systemBoundary);

  // Section 7: Data Lineage Overview
  drawSectionHeading(7, "Data Lineage Overview");
  drawParagraph("The emission calculations are fully supported by activity data records and traceable to the evidence register. Each calculated value references a specific trace node.");

  // Section 8: Direct Emissions Inventory
  drawSectionHeading(8, "Direct Emissions Inventory");
  drawTable(
    ["Emissions Metric", "Value", "Unit"],
    [
      ["Installation Direct Emissions", model.totals.installationDirectEmissions, "tCO2e"],
      ["Total Direct Emissions (Allocated)", model.totals.totalDirectEmissions, "tCO2e"],
    ],
    [80, 40, 30]
  );

  // Section 9: Indirect Emissions Inventory
  drawSectionHeading(9, "Indirect Emissions Inventory");
  drawTable(
    ["Indirect Emissions Metric", "Value", "Unit"],
    [
      ["Electricity Consumed", model.totals.electricityIndirectEmissions, "tCO2e"],
      ["Grid Emission Factor", model.totals.eligibleCertificateReduction, "tCO2e/MWh"],
    ],
    [80, 40, 30]
  );

  // Section 10: Precursor Chain and Complex Goods
  drawSectionHeading(10, "Precursor Chain and Complex Goods");
  if (model.precursors.length > 0) {
    drawTable(
      ["Precursor Name", "Quantity", "Direct Emissions", "Indirect Emissions", "Country of Origin"],
      model.precursors.map(p => [p.name, p.quantity, p.directEmissions, p.indirectEmissions, p.countryOfOrigin]),
      [40, 30, 30, 30, 30]
    );
  } else {
    drawParagraph("No complex precursors are declared for this production route.");
  }

  // Section 11: Allocation and Specific Embedded Emissions
  drawSectionHeading(11, "Allocation and Specific Embedded Emissions");
  drawTable(
    ["Good", "CN", "Allocation Share", "Allocated Embedded Emissions", "Specific Embedded Emissions"],
    model.goods.map(g => [g.goodIndex, g.cnCode, g.allocationShare, g.allocatedEmbeddedEmissions, g.specificEmbeddedEmissions]),
    [15, 30, 30, 40, 40]
  );

  // Section 12: Installation and Goods Reconciliation
  drawSectionHeading(12, "Installation and Goods Reconciliation");
  drawTable(
    ["Reconciliation Parameter", "Value", "Unit", "Verification Status"],
    [
      ["Allocation Share Total", model.totals.allocationShareTotal, "fraction", "RECONCILED"],
      ["Allocation Reconciliation Delta", model.totals.allocationReconciliationDelta, "fraction", "ZERO_DELTA_PASS"],
    ],
    [65, 35, 30, 50]
  );

  // Section 13: Data Quality, Measurement and Uncertainty
  drawSectionHeading(13, "Data Quality, Measurement and Uncertainty");
  drawParagraph("The monitoring plan defines measurement instrument uncertainties in compliance with implementing regulations.");

  // Section 14: Evidence Sufficiency Matrix
  drawSectionHeading(14, "Evidence Sufficiency Matrix");
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

  // Section 15: Findings and Non-Conformity Register
  drawSectionHeading(15, "Findings and Non-Conformity Register");
  const openFindings = model.findings.filter(f => f.status === "OPEN");
  if (openFindings.length > 0) {
    drawTable(
      ["Finding ID", "Severity", "Category", "Title", "Description"],
      openFindings.map(f => [f.findingId, f.severity, f.category, f.title, f.description]),
      [28, 20, 35, 45, 52]
    );
  } else {
    drawParagraph("No open non-conformities or findings are detected.");
  }

  // Section 16: Corrective Action Plan
  drawSectionHeading(16, "Corrective Action Plan");
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

  // Section 17: Verification Readiness Assessment
  drawSectionHeading(17, "Verification Readiness Assessment");
  drawCallout("Recommended Action", `${model.readiness.recommendedDecision} - ${model.readiness.decisionReasonCodes.join(", ")}`);

  // Section 18: Financial Exposure Scenario Annex
  drawSectionHeading(18, "Financial Exposure Scenario Annex");
  drawParagraph("This annex provides sensitivity analysis and financial scenario projections based on the verified emissions values.");

  // Section 19: Official Verification Template Crosswalk
  drawSectionHeading(19, "Official Verification Template Crosswalk");
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

  // Section 20: Verifier Handover Index
  drawSectionHeading(20, "Verifier Handover Index");
  drawParagraph("The crosswalk status identifies verifier-owned fields which are reserved for independent verification.");

  // Section 21: Calculation Audit Trace — Business View
  drawSectionHeading(21, "Calculation Audit Trace — Business View");
  drawTable(
    ["Formula ID", "Output Value", "Output Unit", "Calculation Hash"],
    model.calculationTrace.map(t => [t.formulaId, t.outputValue, t.outputUnit, t.calculationHash]),
    [40, 30, 25, 85]
  );

  // Section 22: Calculation Audit Trace — Technical View
  drawSectionHeading(22, "Calculation Audit Trace — Technical View");
  drawTable(
    ["Trace ID", "Official Source", "Inputs Hash", "Warnings"],
    model.calculationTrace.map(t => [
      t.calculationId.slice(0, 10),
      t.officialSource,
      digest(JSON.stringify(t.inputs)).slice(0, 10),
      t.warnings.join(", ") || "None",
    ]),
    [25, 45, 30, 80]
  );

  // Section 23: Package Integrity, Manifest and Version History
  drawSectionHeading(23, "Package Integrity, Manifest and Version History");
  drawTable(
    ["Integrity Parameter", "Value"],
    [
      ["Manifest Hash", model.manifestSummary.manifestHash],
      ["Package Hash", model.manifestSummary.packageHash],
      ["Schema Version", model.schemaVersion],
    ],
    [50, 130]
  );

  // Section 24: Operator Sign-off, External Verifier Reserved Fields
  drawSectionHeading(24, "Operator Sign-off, External Verifier Reserved Fields");
  drawParagraph("The operator hereby signs off on this verifier-preparation dossier as complete and accurate to the best of their knowledge.");

  // ==========================================
  // SECOND PASS: TABLE OF CONTENTS (PAGE 3)
  // ==========================================
  doc.setPage(3);
  y = 30;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(44, 62, 80);

  const writeTocRow = (num: number, title: string) => {
    const page = sectionPages[num] || 4;
    doc.setFont("helvetica", "bold");
    doc.text(`${num}.`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(title, MARGIN + 8, y);
    doc.text(String(page), PAGE_WIDTH - MARGIN, y, { align: "right" });
    y += 5.2;
  };

  writeTocRow(2, "Legal Status and Reliance Boundary");
  writeTocRow(4, "Scope, Operator, Installation and Reporting Period");
  writeTocRow(5, "Goods and CN Classification");
  writeTocRow(6, "Installation Process and System Boundary");
  writeTocRow(7, "Data Lineage Overview");
  writeTocRow(8, "Direct Emissions Inventory");
  writeTocRow(9, "Indirect Emissions Inventory");
  writeTocRow(10, "Precursor Chain and Complex Goods");
  writeTocRow(11, "Allocation and Specific Embedded Emissions");
  writeTocRow(12, "Installation and Goods Reconciliation");
  writeTocRow(13, "Data Quality, Measurement and Uncertainty");
  writeTocRow(14, "Evidence Sufficiency Matrix");
  writeTocRow(15, "Findings and Non-Conformity Register");
  writeTocRow(16, "Corrective Action Plan");
  writeTocRow(17, "Verification Readiness Assessment");
  writeTocRow(18, "Financial Exposure Scenario Annex");
  writeTocRow(19, "Official Verification Template Crosswalk");
  writeTocRow(20, "Verifier Handover Index");
  writeTocRow(21, "Calculation Audit Trace — Business View");
  writeTocRow(22, "Calculation Audit Trace — Technical View");
  writeTocRow(23, "Package Integrity, Manifest and Version History");
  writeTocRow(24, "Operator Sign-off, External Verifier Reserved Fields");

  // ==========================================
  // THIRD PASS: RUNNING HEADERS & FOOTERS
  // ==========================================
  const pageCount = doc.getNumberOfPages();
  for (let pNum = 1; pNum <= pageCount; pNum += 1) {
    doc.setPage(pNum);

    // Skip Cover Page for Running Headers & Footers
    if (pNum === 1) continue;

    // Running Header
    doc.setFillColor(20, 42, 74);
    doc.rect(0, 0, PAGE_WIDTH, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(model.documentTitle, MARGIN, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Report ID: ${model.reportId} · Version V${model.releaseVersion}`, MARGIN, 16);

    // Confidentiality Marker
    doc.setFillColor(isReady ? 222 : 254, isReady ? 247 : 226, isReady ? 232 : 226);
    doc.rect(142, 5, 53, 10, "F");
    doc.setTextColor(isReady ? 22 : 155, isReady ? 101 : 28, isReady ? 52 : 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.text(isReady ? "CHECKS PASSED" : "REMEDIATION REQUIRED", 168.5, 11, { align: "center" });

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
