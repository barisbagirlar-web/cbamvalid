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
async function getCase(caseId) {
    (0, firestore_validator_1.validateIdentifier)("caseId", caseId);
    const doc = await firebase_admin_1.adminDb.collection("cbam_cases").doc(caseId).get();
    if (!doc.exists)
        return null;
    return doc.data();
}
async function verifyCaseOwner(caseId, uid) {
    (0, firestore_validator_1.validateIdentifier)("caseId", caseId);
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const cbamCase = await getCase(caseId);
    if (!cbamCase)
        throw new Error(`Case with ID ${caseId} was not found.`);
    if (cbamCase.uid !== uid)
        throw new commerce_errors_1.CaseOwnershipViolationError(caseId);
    return cbamCase;
}
async function createCase(uid, data) {
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const caseRef = firebase_admin_1.adminDb.collection("cbam_cases").doc();
    const caseId = `case_${caseRef.id}`;
    const now = new Date().toISOString();
    const cbamCase = {
        caseId,
        uid,
        data: Object.assign(Object.assign({}, data), { caseId, ownerId: uid }),
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
    };
    await firebase_admin_1.adminDb.collection("cbam_cases").doc(caseId).set(cbamCase);
    return cbamCase;
}
async function updateCase(caseId, uid, data) {
    (0, firestore_validator_1.validateIdentifier)("caseId", caseId);
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const cbamCase = await verifyCaseOwner(caseId, uid);
    if (cbamCase.status !== "DRAFT") {
        throw new Error("CASE_NOT_EDITABLE");
    }
    const now = new Date().toISOString();
    const normalizedData = Object.assign(Object.assign({}, data), { caseId, ownerId: uid });
    const updated = {
        data: normalizedData,
        updatedAt: now,
    };
    await firebase_admin_1.adminDb.collection("cbam_cases").doc(caseId).update(updated);
    return Object.assign(Object.assign({}, cbamCase), updated);
}
async function getCasesForUser(uid) {
    (0, firestore_validator_1.validateIdentifier)("uid", uid);
    const snapshot = await firebase_admin_1.adminDb.collection("cbam_cases").where("uid", "==", uid).get();
    return snapshot.docs
        .map((doc) => (Object.assign({ caseId: doc.id }, doc.data())))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
//# sourceMappingURL=case-repository.js.map