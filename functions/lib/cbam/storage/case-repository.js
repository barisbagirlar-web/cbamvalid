"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCase = getCase;
exports.verifyCaseOwner = verifyCaseOwner;
exports.createCase = createCase;
exports.updateCase = updateCase;
exports.getCasesForUser = getCasesForUser;
const firebase_admin_1 = require("@/firebase-admin");
const commerce_errors_1 = require("../../commerce/commerce-errors");
const firestore_validator_1 = require("@/firestore-validator");
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
    if (data === null || data === void 0 ? void 0 : data.cnCode) {
        (0, firestore_validator_1.validateIdentifier)("cnCode", data.cnCode);
    }
    const caseRef = firebase_admin_1.adminDb.collection("cbam_cases").doc();
    const caseId = `case_${caseRef.id}`;
    const now = new Date().toISOString();
    const cbamCase = {
        caseId,
        uid,
        data,
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
    if (data === null || data === void 0 ? void 0 : data.cnCode) {
        (0, firestore_validator_1.validateIdentifier)("cnCode", data.cnCode);
    }
    const cbamCase = await verifyCaseOwner(caseId, uid);
    const now = new Date().toISOString();
    const updated = {
        data,
        updatedAt: now,
    };
    await firebase_admin_1.adminDb.collection("cbam_cases").doc(caseId).update(updated);
    return Object.assign(Object.assign({}, cbamCase), updated);
}
async function getCasesForUser(uid) {
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const snapshot = await firebase_admin_1.adminDb.collection("cbam_cases").where("uid", "==", uid).get();
    return snapshot.docs.map(doc => doc.data());
}
//# sourceMappingURL=case-repository.js.map