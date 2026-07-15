import { z } from "zod";

export const CreditSummarySchema = z.object({
  availableCredits: z.number().int().nonnegative(),
  lifetimePurchased: z.number().int().nonnegative(),
  lifetimeConsumed: z.number().int().nonnegative(),
  lifetimeAdjusted: z.number().int().nonnegative(),
  lifetimeRefunded: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export const AccountOverviewSchema = z.object({
  profile: z.object({
    displayName: z.string(),
    email: z.string(),
    companyName: z.string(),
    phone: z.string(),
    country: z.string(),
  }),
  creditSummary: CreditSummarySchema,
  authenticatedAt: z.string(),
});

export const CreditLedgerEntrySchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: z.number().int(),
  reason: z.string(),
  balanceAfter: z.number().int().nonnegative(),
  createdAt: z.string(),
  orderId: z.string().nullable().optional(),
  reportId: z.string().nullable().optional(),
});

export const PurchaseHistoryEntrySchema = z.object({
  eventId: z.string(),
  eventType: z.string(),
  occurredAt: z.string(),
  processingState: z.string(),
  transactionId: z.string(),
  orderId: z.string(),
  productCode: z.string(),
});

export type AccountOverview = z.infer<typeof AccountOverviewSchema>;
export type CreditLedgerEntry = z.infer<typeof CreditLedgerEntrySchema>;
export type PurchaseHistoryEntry = z.infer<typeof PurchaseHistoryEntrySchema>;
