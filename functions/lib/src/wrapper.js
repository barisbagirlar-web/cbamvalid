"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCallable = createCallable;
const https_1 = require("firebase-functions/v2/https");
function createCallable(options, handler) {
    return (0, https_1.onCall)(Object.assign({ region: "europe-west1", enforceAppCheck: true }, options), async (request) => {
        var _a;
        try {
            // 1. App Check validation (handled natively by enforceAppCheck: true, but we can verify it's not strictly null if we wanted, though enforceAppCheck is better)
            if (!request.app && options.enforceAppCheck !== false) {
                throw new https_1.HttpsError("unauthenticated", "App Check token is missing or invalid.");
            }
            // 2. Auth extraction
            if (!request.auth) {
                throw new https_1.HttpsError("unauthenticated", "User must be authenticated.");
            }
            // 3. Input validation
            let validatedData = request.data;
            if (options.schema) {
                const parseResult = options.schema.safeParse(request.data);
                if (!parseResult.success) {
                    console.error("Validation error:", parseResult.error);
                    throw new https_1.HttpsError("invalid-argument", "Invalid input data format.");
                }
                validatedData = parseResult.data;
            }
            // 4. Execution with correlation logging
            const startTime = Date.now();
            console.log(`[CALLABLE START] uid=${request.auth.uid}`);
            const result = await handler(validatedData, request);
            console.log(`[CALLABLE END] uid=${request.auth.uid} duration=${Date.now() - startTime}ms`);
            return result;
        }
        catch (error) {
            console.error(`[CALLABLE ERROR] uid=${(_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid}`, error);
            if (error instanceof https_1.HttpsError) {
                throw error;
            }
            throw new https_1.HttpsError("internal", error.message || "An internal error occurred.");
        }
    });
}
//# sourceMappingURL=wrapper.js.map