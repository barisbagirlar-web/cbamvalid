"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEvidenceCsv = generateEvidenceCsv;
function generateEvidenceCsv(caseData) {
    const header = [
        "Evidence ID",
        "Document Type",
        "File Name",
        "Issuer",
        "Issue Date",
        "Reporting Period",
        "File Hash",
        "Upload Timestamp",
        "Uploader",
        "Review Status",
        "Linked Inputs Count"
    ];
    const rows = caseData.evidenceRegister.map(ev => [
        ev.evidenceId,
        `"${ev.documentType}"`,
        `"${ev.fileName}"`,
        `"${ev.issuer}"`,
        `"${ev.issueDate}"`,
        `"${ev.reportingPeriod}"`,
        ev.fileHash,
        ev.uploadTimestamp,
        `"${ev.uploader}"`,
        ev.reviewStatus,
        ev.linkedInputs.length.toString()
    ]);
    return [header.join(","), ...rows.map(r => r.join(","))].join("\n");
}
//# sourceMappingURL=evidence-export.js.map