/**
 * Customer-facing purchase history derived from commerce_orders (SSOT).
 * Do not read paddle_events for customer UI — those records have no uid index
 * and may be empty when fulfillment ran via /api/checkout/confirm.
 */

export type CustomerPurchaseStatus =
  | "PAID"
  | "PENDING"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED"
  | "UNKNOWN";

export type CustomerPurchaseRecord = {
  id: string;
  orderId: string;
  occurredAt: string;
  amountMinor: number;
  amountFormatted: string;
  currency: string;
  transactionId: string | null;
  status: CustomerPurchaseStatus;
  statusLabel: string;
  productLabel: string;
  rawStatus: string;
};

function formatAmount(amountMinor: number, currency: string): string {
  const major = (Number(amountMinor) || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(major);
  } catch {
    return `$${major.toFixed(2)}`;
  }
}

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
  if (
    status === "DRAFT" ||
    status === "CHECKOUT_CREATED" ||
    status === "PAYMENT_PENDING"
  ) {
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

export function toCustomerPurchaseRecord(
  id: string,
  data: Record<string, unknown>
): CustomerPurchaseRecord {
  const rawStatus = String(data.status || "");
  const mapped = mapOrderStatusToCustomer(rawStatus);
  const currency = String(data.currency || "USD");
  const amountMinor = Number(data.amountMinor || 0);
  const occurredAt = String(data.createdAt || data.updatedAt || "");
  const transactionId =
    typeof data.paddleTransactionId === "string" && data.paddleTransactionId
      ? data.paddleTransactionId
      : null;

  return {
    id,
    orderId: String(data.orderId || id),
    occurredAt,
    amountMinor,
    amountFormatted: formatAmount(amountMinor, currency),
    currency,
    transactionId,
    status: mapped.status,
    statusLabel: mapped.statusLabel,
    productLabel: "Preparation Pack",
    rawStatus,
  };
}
