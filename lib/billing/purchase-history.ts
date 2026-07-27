/**
 * Customer-facing purchase history mapping (mirrors functions/src/commerce/purchase-history.ts).
 * Keep labels in sync — account UI depends on status + statusLabel.
 */

export type CustomerPurchaseStatus =
  | "PAID"
  | "PENDING"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED"
  | "UNKNOWN";

export function mapOrderStatusToCustomer(rawStatus: unknown): {
  status: CustomerPurchaseStatus;
  statusLabel: string;
} {
  const status = String(rawStatus || "").toUpperCase();
  if (
    status === "ENTITLED" ||
    status === "PAID" ||
    status === "REPORT_RESERVED" ||
    status === "REPORT_CALCULATED" ||
    status === "REPORT_SEALED" ||
    status === "DELIVERED"
  ) {
    return { status: "PAID", statusLabel: "Paid — pack active" };
  }
  if (status === "DRAFT" || status === "CHECKOUT_CREATED" || status === "PAYMENT_PENDING") {
    return { status: "PENDING", statusLabel: "Payment pending" };
  }
  if (status === "PAYMENT_FAILED") {
    return { status: "FAILED", statusLabel: "Payment failed" };
  }
  if (status === "PAYMENT_CANCELED") {
    return { status: "CANCELED", statusLabel: "Checkout canceled" };
  }
  if (status === "REFUNDED_UNUSED" || status === "REFUNDED_AFTER_DELIVERY") {
    return { status: "REFUNDED", statusLabel: "Refunded" };
  }
  return { status: "UNKNOWN", statusLabel: status || "Unknown" };
}
