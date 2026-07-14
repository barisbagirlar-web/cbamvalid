"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicateEventError = exports.InvalidWebhookSignatureError = exports.DoubleSpendViolationError = exports.EntitlementUnavailableError = exports.InvalidProductCodeError = exports.CaseOwnershipViolationError = exports.OrderNotFoundError = exports.CommerceError = void 0;
class CommerceError extends Error {
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
        this.name = "CommerceError";
    }
}
exports.CommerceError = CommerceError;
class OrderNotFoundError extends CommerceError {
    constructor(orderId) {
        super("ORDER_NOT_FOUND", `Order with ID ${orderId} was not found.`, 404);
    }
}
exports.OrderNotFoundError = OrderNotFoundError;
class CaseOwnershipViolationError extends CommerceError {
    constructor(caseId) {
        super("CASE_OWNERSHIP_VIOLATION", `Session user is not the owner of case ${caseId}.`, 403);
    }
}
exports.CaseOwnershipViolationError = CaseOwnershipViolationError;
class InvalidProductCodeError extends CommerceError {
    constructor(productCode) {
        super("INVALID_PRODUCT_CODE", `Product code ${productCode} is invalid or inactive.`, 400);
    }
}
exports.InvalidProductCodeError = InvalidProductCodeError;
class EntitlementUnavailableError extends CommerceError {
    constructor(message = "No available entitlement found for the requested operations.") {
        super("ENTITLEMENT_UNAVAILABLE", message, 409);
    }
}
exports.EntitlementUnavailableError = EntitlementUnavailableError;
class DoubleSpendViolationError extends CommerceError {
    constructor(entitlementId) {
        super("DOUBLE_SPEND_VIOLATION", `Entitlement ${entitlementId} is already reserved or consumed.`, 409);
    }
}
exports.DoubleSpendViolationError = DoubleSpendViolationError;
class InvalidWebhookSignatureError extends CommerceError {
    constructor() {
        super("INVALID_WEBHOOK_SIGNATURE", "The webhook signature header is invalid or missing.", 401);
    }
}
exports.InvalidWebhookSignatureError = InvalidWebhookSignatureError;
class DuplicateEventError extends CommerceError {
    constructor(eventId) {
        super("DUPLICATE_EVENT", `Event with ID ${eventId} has already been parsed and processed.`, 200); // 200 to acknowledge quickly without duplicated mutations
    }
}
exports.DuplicateEventError = DuplicateEventError;
//# sourceMappingURL=commerce-errors.js.map