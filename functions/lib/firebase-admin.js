"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageBucket = exports.adminStorage = exports.adminDb = exports.adminAuth = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
let app;
if (!(0, app_1.getApps)().length) {
    app = (0, app_1.initializeApp)();
}
else {
    app = (0, app_1.getApp)();
}
exports.adminAuth = (0, auth_1.getAuth)(app);
exports.adminDb = (0, firestore_1.getFirestore)(app);
exports.adminStorage = (0, storage_1.getStorage)(app);
const getStorageBucket = () => exports.adminStorage.bucket();
exports.getStorageBucket = getStorageBucket;
// Use a custom setting for firestore to ignore undefined properties
exports.adminDb.settings({ ignoreUndefinedProperties: true });
//# sourceMappingURL=firebase-admin.js.map