export class CommerceError extends Error {
  constructor(public code: string, message: string, public status: number = 400) {
    super(message);
    this.name = "CommerceError";
  }
}

export class OrderNotFoundError extends CommerceError {
  constructor(orderId: string) {
    super("ORDER_NOT_FOUND", `Order with ID ${orderId} was not found.`, 404);
  }
}

export class CaseOwnershipViolationError extends CommerceError {
  constructor(caseId: string) {
    super("CASE_OWNERSHIP_VIOLATION", `Session user is not the owner of case ${caseId}.`, 403);
  }
}

export class InvalidProductCodeError extends CommerceError {
  constructor(productCode: string) {
    super("INVALID_PRODUCT_CODE", `Product code ${productCode} is invalid or inactive.`, 400);
  }
}

export class EntitlementUnavailableError extends CommerceError {
  constructor(message: string = "No available entitlement found for the requested operations.") {
    super("ENTITLEMENT_UNAVAILABLE", message, 409);
  }
}

export class DoubleSpendViolationError extends CommerceError {
  constructor(entitlementId: string) {
    super("DOUBLE_SPEND_VIOLATION", `Entitlement ${entitlementId} is already reserved or consumed.`, 409);
  }
}

export class InvalidWebhookSignatureError extends CommerceError {
  constructor() {
    super("INVALID_WEBHOOK_SIGNATURE", "The webhook signature header is invalid or missing.", 401);
  }
}

export class DuplicateEventError extends CommerceError {
  constructor(eventId: string) {
    super("DUPLICATE_EVENT", `Event with ID ${eventId} has already been parsed and processed.`, 200); // 200 to acknowledge quickly without duplicated mutations
  }
}
