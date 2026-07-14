"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCase = getCase;
exports.verifyCaseOwner = verifyCaseOwner;
exports.createCase = createCase;
exports.updateCase = updateCase;
exports.getCasesForUser = getCasesForUser;
const firebase_admin_1 = require("../../firebase-admin");
const commerce_errors_1 = require("../../commerce/commerce-errors");
const firestore_validator_1 = require("../../firestore-validator");
const schema_1 = require("../schema");
/**
 * Helper to sanitize case data on write (Phase 2 & Phase 3 evidence status verification)
 */
function sanitizeCaseData(submittedData, existingData) {
    // Parse with schema
    const parsed = schema_1.AuditReadyCaseSchema.parse(submittedData);
    // Sanitize evidence records
    const existingEvidences = (existingData === null || existingData === void 0 ? void 0 : existingData.evidenceRegister) || [];
    const existingMap = new Map(existingEvidences.map((e) => [e.evidenceId, e]));
    parsed.evidenceRegister = parsed.evidenceRegister.map(ev => {
        const existing = existingMap.get(ev.evidenceId);
        if (existing) {
            // Force status back to PENDING if they try to escalate it without admin approval
            const reviewStatus = ev.reviewStatus === "APPROVED" && existing.reviewStatus !== "APPROVED" ? "PENDING" : ev.reviewStatus;
            const supportStatus = ev.supportStatus === "SUPPORTED" && existing.supportStatus !== "SUPPORTED" ? "PENDING" : ev.supportStatus;
            return Object.assign(Object.assign({}, ev), { reviewStatus,
                supportStatus });
        }
        else {
            // New evidence must start as PENDING
            return Object.assign(Object.assign({}, ev), { reviewStatus: "PENDING", supportStatus: "PENDING" });
        }
    });
    // Recalculate carbon price reduction based on approved evidence records
    const approvedEvidenceIds = new Set(parsed.evidenceRegister
        .filter(e => e.reviewStatus === "APPROVED" && e.supportStatus === "SUPPORTED")
        .map(e => e.evidenceId));
    parsed.carbonPriceRecords = parsed.carbonPriceRecords.map(rec => {
        if (!rec.proofOfPaymentEvidenceId || !approvedEvidenceIds.has(rec.proofOfPaymentEvidenceId)) {
            return Object.assign(Object.assign({}, rec), { eligibleCertificateReduction: 0 });
        }
        return rec;
    });
    return parsed;
}
/**
 * Retrieve case data by ID
 */
async function getCase(caseId) {
    (0, firestore_validator_1.validateIdentifier)("caseId", caseId);
    const doc = await firebase_admin_1.adminDb.collection("cbam_cases").doc(caseId).get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
/**
 * Verify if the case belongs to the given user UID
 */
async function verifyCaseOwner(caseId, uid) {
    (0, firestore_validator_1.validateIdentifier)("caseId", caseId);
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const cbamCase = await getCase(caseId);
    if (!cbamCase) {
        throw new Error(`Case with ID ${caseId} was not found.`);
    }
    if (cbamCase.uid !== uid) {
        throw new commerce_errors_1.CaseOwnershipViolationError(caseId);
    }
    return cbamCase;
}
/**
 * Create a new draft case document
 */
async function createCase(uid, data) {
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const caseRef = firebase_admin_1.adminDb.collection("cbam_cases").doc();
    const caseId = `case_${caseRef.id}`;
    const now = new Date().toISOString();
    // Attach generated caseId to data
    const caseData = Object.assign(Object.assign({}, data), { caseId, ownerId: uid });
    const sanitized = sanitizeCaseData(caseData);
    const cbamCase = {
        caseId,
        uid,
        data: sanitized,
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
    };
    await caseRef.set(cbamCase);
    return cbamCase;
}
/**
 * Update an existing draft case document
 */
async function updateCase(caseId, uid, data) {
    (0, firestore_validator_1.validateIdentifier)("caseId", caseId);
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const cbamCase = await verifyCaseOwner(caseId, uid);
    const now = new Date().toISOString();
    // Ensure caseId is bound correctly
    const caseData = Object.assign(Object.assign({}, data), { caseId, ownerId: uid });
    const sanitized = sanitizeCaseData(caseData, cbamCase.data);
    const updated = {
        data: sanitized,
        updatedAt: now,
    };
    await firebase_admin_1.adminDb.collection("cbam_cases").doc(caseId).update(updated);
    return Object.assign(Object.assign({}, cbamCase), updated);
}
async function getCasesForUser(uid) {
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const snapshot = await firebase_admin_1.adminDb.collection("cbam_cases").where("uid", "==", uid).get();
    return snapshot.docs.map((doc) => (Object.assign({ caseId: doc.id }, doc.data())));
}
//# sourceMappingURL=case-repository.js.map