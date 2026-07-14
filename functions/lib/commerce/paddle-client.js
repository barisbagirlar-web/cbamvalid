"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paddle = void 0;
exports.isSandboxMode = isSandboxMode;
const paddle_node_sdk_1 = require("@paddle/paddle-node-sdk");
const apiKey = process.env.PADDLE_API_KEY || "";
const isSandbox = process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" || process.env.NODE_ENV !== "production";
if (!apiKey) {
    console.warn("[PADDLE] Warning: PADDLE_API_KEY environment variable is not defined.");
}
exports.paddle = new paddle_node_sdk_1.Paddle(apiKey, {
    environment: isSandbox ? paddle_node_sdk_1.Environment.sandbox : paddle_node_sdk_1.Environment.production,
});
function isSandboxMode() {
    return isSandbox;
}
//# sourceMappingURL=paddle-client.js.map