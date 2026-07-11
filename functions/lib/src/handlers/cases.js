"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
        // check ownership
        const existing = await (0, case_repository_1.getCase)(caseId);
        if (!existing || existing.uid !== auth.uid) {
            throw new Error("Case not found or access denied.");
        }
        await (0, case_repository_1.updateCase)(caseId, data);
        return { caseId, status: "success" };
    }
    else {
        const newCaseId = await (0, case_repository_1.createCase)(auth.uid, data);
        return { caseId: newCaseId, status: "success" };
    }
});
exports.getCbamCases = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const cases = await (0, case_repository_1.getCasesForUser)(auth.uid);
    return { cases, status: "success" };
});
exports.calculateCbam = (0, wrapper_1.createCallable)({}, async (data, _) => {
    // We can just rely on the existing calculation engine if needed. But we don't really have a backend calculate endpoint in the original.
    // Wait, the client used to calculate and save. 
    // Let's implement calculateCbam by importing calculation-engine.
    const { calculateCbamObligation } = await Promise.resolve().then(() => __importStar(require("@/cbam/calculation/calculation-engine")));
    try {
        const result = calculateCbamObligation(data);
        return { data: result, status: "success" };
    }
    catch (err) {
        throw new Error(err.message);
    }
});
exports.getSourcesStatus = (0, wrapper_1.createCallable)({}, async () => {
    return { status: "success", sources: [] }; // Mock for now
});
//# sourceMappingURL=cases.js.map