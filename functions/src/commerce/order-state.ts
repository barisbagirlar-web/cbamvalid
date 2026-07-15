export const ORDER_STATUSES = [
  "DRAFT",
  "CHECKOUT_CREATED",
  "PAYMENT_PENDING",
  "PAID",
  "ENTITLED",
  "REPORT_RESERVED",
  "REPORT_CALCULATED",
  "REPORT_SEALED",
  "DELIVERED",
  "PAYMENT_FAILED",
  "PAYMENT_CANCELED",
  "REFUNDED_UNUSED",
  "REFUNDED_AFTER_DELIVERY",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = Object.freeze({
  DRAFT: ["CHECKOUT_CREATED"],
  CHECKOUT_CREATED: ["PAYMENT_PENDING", "PAID", "PAYMENT_FAILED", "PAYMENT_CANCELED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "PAYMENT_CANCELED"],
  PAID: ["ENTITLED", "REFUNDED_UNUSED"],
  ENTITLED: ["REPORT_RESERVED", "REFUNDED_UNUSED"],
  REPORT_RESERVED: ["REPORT_CALCULATED", "ENTITLED", "REFUNDED_UNUSED"],
  REPORT_CALCULATED: ["REPORT_SEALED", "ENTITLED"],
  REPORT_SEALED: ["DELIVERED", "REFUNDED_AFTER_DELIVERY"],
  DELIVERED: ["REFUNDED_AFTER_DELIVERY"],
  PAYMENT_FAILED: ["CHECKOUT_CREATED"],
  PAYMENT_CANCELED: ["CHECKOUT_CREATED"],
  REFUNDED_UNUSED: [],
  REFUNDED_AFTER_DELIVERY: [],
});

export function isOrderTransitionAllowed(current: OrderStatus, target: OrderStatus): boolean {
  return current === target || ORDER_TRANSITIONS[current].includes(target);
}

export function assertOrderTransition(current: OrderStatus, target: OrderStatus): void {
  if (!isOrderTransitionAllowed(current, target)) {
    throw new Error(`ORDER_STATE_TRANSITION_INVALID:${current}:${target}`);
  }
}
