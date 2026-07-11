"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSourcesStatus = exports.calculateCbam = exports.getCbamCases = exports.saveCbamCase = void 0;
const wrapper_1 = require("../wrapper");
const zod_1 = require("zod");
const case_repository_1 = require("@/cbam/storage/case-repository");
exports.saveCbamCase = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        caseId: zod_1.z.string().optional(),
        data: zod_1.z.any()
    })
}, async ({ caseId, data }, { auth }) => {
    if (caseId) {
        const existing = await (0, case_repository_1.getCase)(caseId);
        if (!existing || existing.uid !== auth.uid) {
            throw new Error("Case not found or access denied.");
        }
        await (0, case_repository_1.updateCase)(caseId, auth.uid, data);
        return { caseId, status: "success" };
    }
    else {
        const newCase = await (0, case_repository_1.createCase)(auth.uid, data);
        return { caseId: newCase.caseId, status: "success" };
    }
});
exports.getCbamCases = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const cases = await (0, case_repository_1.getCasesForUser)(auth.uid);
    return { cases, status: "success" };
});
exports.calculateCbam = (0, wrapper_1.createCallable)({}, async (data, _) => {
    return { data: {}, status: "success" };
});
exports.getSourcesStatus = (0, wrapper_1.createCallable)({}, async () => {
    return { status: "success", sources: [] };
});
//# sourceMappingURL=cases.js.map