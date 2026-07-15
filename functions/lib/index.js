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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const v2_1 = require("firebase-functions/v2");
// Set maximum timeout and memory for all functions
(0, v2_1.setGlobalOptions)({
    region: "europe-west1",
    maxInstances: 10,
});
__exportStar(require("./handlers/cases"), exports);
__exportStar(require("./handlers/reports"), exports);
__exportStar(require("./handlers/commerce"), exports);
__exportStar(require("./handlers/account"), exports);
__exportStar(require("./handlers/admin"), exports);
__exportStar(require("./webhook"), exports);
__exportStar(require("./cbam/report/seal-recovery-worker"), exports);
//# sourceMappingURL=index.js.map