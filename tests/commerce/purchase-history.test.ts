import { describe, expect, it } from "vitest";
import { mapOrderStatusToCustomer } from "@/lib/billing/purchase-history";

describe("mapOrderStatusToCustomer", () => {
  it("marks entitled and paid orders as Paid — pack active", () => {
    expect(mapOrderStatusToCustomer("ENTITLED")).toEqual({
      status: "PAID",
      statusLabel: "Paid — pack active",
    });
    expect(mapOrderStatusToCustomer("PAID").status).toBe("PAID");
    expect(mapOrderStatusToCustomer("DELIVERED").status).toBe("PAID");
  });

  it("marks checkout and pending as Payment pending", () => {
    expect(mapOrderStatusToCustomer("CHECKOUT_CREATED")).toEqual({
      status: "PENDING",
      statusLabel: "Payment pending",
    });
    expect(mapOrderStatusToCustomer("PAYMENT_PENDING").status).toBe("PENDING");
  });

  it("marks failed and refunded clearly", () => {
    expect(mapOrderStatusToCustomer("PAYMENT_FAILED")).toEqual({
      status: "FAILED",
      statusLabel: "Payment failed",
    });
    expect(mapOrderStatusToCustomer("REFUNDED_UNUSED").status).toBe("REFUNDED");
  });
});
