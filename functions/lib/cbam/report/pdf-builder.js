"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPdfDossier = buildPdfDossier;
const jspdf_1 = require("jspdf");
/**
 * Builds the cost evidence PDF report dossier and returns it as a Buffer
 */
function buildPdfDossier(data, calc, docHash, isSample, redactForPublicSample) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
    const doc = new jspdf_1.jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    });
    const renderText = (text, x, y, isRedacted) => {
        if (isRedacted && redactForPublicSample) {
            doc.setFillColor(220, 220, 220);
            const textWidth = doc.getTextWidth("REDACTED IN PUBLIC SAMPLE") + 4;
            doc.rect(x - 1, y - 4, textWidth, 5, "F");
            doc.text("REDACTED IN PUBLIC SAMPLE", x, y);
        }
        else {
            doc.text(text, x, y);
        }
    };
    if (isSample) {
        doc.setTextColor(220, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("SAMPLE REPORT - Fictional demonstration data - Not valid for regulatory use", 15, 10);
        doc.setTextColor(0, 0, 0);
    }
    // Metadata isolation
    doc.setProperties({
        title: redactForPublicSample ? "CBAMValid Sample Dossier" : `CBAM_Dossier_${data.cnCode || ((_a = calc.inputs) === null || _a === void 0 ? void 0 : _a.cnCode)}`,
        author: "CBAMValid",
        creator: "CBAMValid Report Engine",
        subject: redactForPublicSample ? "Fictional Demonstration Dossier" : "CBAM Definitive Dossier",
        keywords: redactForPublicSample ? "CBAM, sample dossier, demonstration" : ""
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
    doc.text(`EORI: `, 15, 40);
    renderText(data.declarantEORI || ((_c = (_b = data.importer) === null || _b === void 0 ? void 0 : _b.eori) === null || _c === void 0 ? void 0 : _c.value) || "N/A", 30, 40, true);
    doc.text(`Reporting Year: ${((_d = calc.inputs) === null || _d === void 0 ? void 0 : _d.importYear) || ((_f = (_e = data.reportingPeriod) === null || _e === void 0 ? void 0 : _e.year) === null || _f === void 0 ? void 0 : _f.value)}`, 15, 45);
    doc.text(`Goods Classification CN Code: ${((_g = calc.inputs) === null || _g === void 0 ? void 0 : _g.cnCode) || ((_k = (_j = (_h = data.goods) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.cnCode) === null || _k === void 0 ? void 0 : _k.value)}`, 15, 50);
    // Section 2: Installation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("2. Installation & Production Information", 15, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Installation Name: `, 15, 66);
    renderText(data.installationName || ((_m = (_l = data.installation) === null || _l === void 0 ? void 0 : _l.name) === null || _m === void 0 ? void 0 : _m.value) || "N/A", 45, 66, true);
    doc.text(`Production Volume: ${data.productionVolume || ((_q = (_p = (_o = data.goods) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.productionVolume) === null || _q === void 0 ? void 0 : _q.value)} ${((_r = calc.applicability) === null || _r === void 0 ? void 0 : _r.sector) === "ELECTRICITY" ? "MWh" : "Tonnes"}`, 15, 71);
    doc.text(`Complex Good: ${data.isComplexGood !== undefined ? (data.isComplexGood ? "Yes" : "No") : "Yes"}`, 15, 76);
    // Section 3: Calculation Pathway & Applicability
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("3. CBAM Applicability & Pathway Validation", 15, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`CBAM Sector: ${((_s = calc.applicability) === null || _s === void 0 ? void 0 : _s.sector) || "UNKNOWN"}`, 15, 92);
    doc.text(`Applicability Status: ${((_t = calc.applicability) === null || _t === void 0 ? void 0 : _t.isApplicable) ? "APPLICABLE" : "EXEMPT/EXCLUDED"}`, 15, 97);
    doc.text(`Under de minimis mass threshold (50t): ${((_u = calc.applicability) === null || _u === void 0 ? void 0 : _u.underThreshold) ? "Yes (Exempt)" : "No (Subject to CBAM)"}`, 15, 102);
    doc.text(`Pathway Checked: ${((_v = calc.pathway) === null || _v === void 0 ? void 0 : _v.pathway) || "DEFAULT"}`, 15, 107);
    if ((_w = calc.pathway) === null || _w === void 0 ? void 0 : _w.requiresVerificationWarning) {
        doc.setTextColor(200, 0, 0);
        doc.text("WARNING: Actual emissions unverified! INDEPENDENT VERIFICATION REQUIRED.", 15, 112);
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
    doc.text(`Certificates Before Reduction: ${calc.certificatesBeforeReduction} certificates`, 15, 164);
    doc.text(`Carbon Price Paid Currency: ${calc.carbonPricePaidCurrency} EUR (${calc.carbonPricePaidPerTco2e} EUR/tCO2e)`, 15, 169);
    doc.text(`Eligible Certificate Reduction: -${calc.eligibleCertificateReduction} certificates`, 15, 174);
    doc.text(`Net CBAM Certificates Due: ${calc.netCertificatesDue} certificates`, 15, 179);
    doc.text(`Certificate Price: ${((_x = calc.pricing) === null || _x === void 0 ? void 0 : _x.priceEurPerTonne) || "N/A"} EUR/certificate (${((_y = calc.pricing) === null || _y === void 0 ? void 0 : _y.state) || "N/A"})`, 15, 184);
    doc.text(`Estimated CBAM Financial Exposure: ${calc.estimatedCertificateCostEur} EUR`, 15, 189);
    // Section 6: Provenance & Seals
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("6. Sealing & Provenance Integrity", 15, 198);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Calculation engine version: v1.0.0-deterministic`, 15, 205);
    doc.text(`Regulatory ruleset dataset: ${((_z = calc.pricing) === null || _z === void 0 ? void 0 : _z.datasetVersion) || "N/A"}`, 15, 210);
    if (docHash) {
        doc.setFont("helvetica", "bold");
        doc.text(`DOCUMENT SEAL SHA-256 HASH: ${docHash}`, 15, 217);
        doc.setFont("helvetica", "normal");
    }
    // Executive Summary Box
    doc.setDrawColor(0);
    doc.setFillColor(240, 240, 240);
    doc.rect(15, 222, 180, 25, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("EXECUTIVE SUMMARY", 20, 228);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`The declarant `, 20, 234);
    renderText(data.declarantEORI || ((_1 = (_0 = data.importer) === null || _0 === void 0 ? void 0 : _0.eori) === null || _1 === void 0 ? void 0 : _1.value) || "N/A", 42, 234, true);
    const execText = ` imports ${data.productionVolume || ((_4 = (_3 = (_2 = data.goods) === null || _2 === void 0 ? void 0 : _2[0]) === null || _3 === void 0 ? void 0 : _3.productionVolume) === null || _4 === void 0 ? void 0 : _4.value)} tonnes of ${((_5 = calc.applicability) === null || _5 === void 0 ? void 0 : _5.sector) || "goods"}. Based on the evaluated data, total embedded emissions are ${calc.totalEmbeddedEmissions} tCO2e, resulting in an estimated net liability of ${calc.netCertificatesDue} certificates (${calc.estimatedCertificateCostEur} EUR).`;
    doc.text(doc.splitTextToSize(execText, 170), 20, 238);
    // Disclaimer
    doc.line(15, 255, 195, 255);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(150, 150, 150);
    doc.text("LEGAL NOTICE", 15, 263);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    const baseNotice = "Independent compliance software. Not affiliated with, endorsed by, or sponsored by the European Union or the European Commission. The values stated in this document are generated based on the inputs provided by the declarant. The platform acts solely as a computational tool and holds no legal liability regarding the accuracy of the data or any customs penalties applied by the EU authorities.";
    const legalNotice = redactForPublicSample
        ? "This sample dossier is generated from fictional demonstration data using the CBAMValid calculation and report-rendering pipeline. It is provided solely to demonstrate report structure and software capabilities. It is not a customs declaration, an official Registry submission or an accredited verifier opinion."
        : baseNotice;
    const splitNotice = doc.splitTextToSize(legalNotice, 180);
    doc.text(splitNotice, 15, 269);
    // Technical Annex Page
    doc.addPage();
    if (redactForPublicSample) {
        doc.setTextColor(220, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("SAMPLE REPORT - Fictional demonstration data - Not valid for regulatory use", 15, 10);
        doc.setTextColor(0, 0, 0);
    }
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("TECHNICAL ANNEX: CALCULATION TRACE", 15, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("This annex provides the deterministic trace of all mathematical operations performed by the engine.", 15, 27);
    let yOffset = 35;
    if (calc.traces) {
        for (const [key, trace] of Object.entries(calc.traces)) {
            if (yOffset > 270) {
                doc.addPage();
                yOffset = 20;
            }
            doc.setFont("helvetica", "bold");
            doc.text(`Node: ${key} (${trace.formulaId})`, 15, yOffset);
            doc.setFont("helvetica", "normal");
            doc.text(`Rule: ${trace.legalVersionRef} | Unit: ${trace.units}`, 15, yOffset + 5);
            doc.text(`Inputs: `, 15, yOffset + 10);
            renderText(JSON.stringify(trace.inputs), 28, yOffset + 10, true);
            doc.text(`Result: ${trace.finalResult}`, 15, yOffset + 15);
            doc.line(15, yOffset + 18, 195, yOffset + 18);
            yOffset += 25;
        }
    }
    // Footer for all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        if (redactForPublicSample) {
            doc.text(`CBAMValid Sample Dossier | Fictional demonstration data | Not for submission`, 20, 285);
        }
        else {
            doc.text(`CBAMValid Verification-Ready Dossier | ${docHash || "DRAFT"}`, 20, 285);
        }
        doc.text(`Page ${i} of ${pageCount}`, 180, 285);
    }
    const arrayBuffer = doc.output("arraybuffer");
    return Buffer.from(arrayBuffer);
}
//# sourceMappingURL=pdf-builder.js.map