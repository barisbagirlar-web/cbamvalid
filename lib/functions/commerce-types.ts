import { z } from "zod";
import { COMMERCIAL_CONTRACT } from "@/lib/billing/commercial-contract";

export const PreparationPackEntitlementSchema = z.object({
  entitlementId: z.string().min(1),
  uid: z.string().min(1),
  orderId: z.string().min(1),
  productCode: z.literal(COMMERCIAL_CONTRACT.productCode),
  status: z.enum(["AVAILABLE", "RESERVED"]),
  quantity: z.number().int().positive(),
  maxReleases: z.literal(COMMERCIAL_CONTRACT.releasesPerPack),
  releasesCount: z.number().int().min(0).max(COMMERCIAL_CONTRACT.releasesPerPack),
  releasesRemaining: z.number().int().min(1).max(COMMERCIAL_CONTRACT.releasesPerPack),
  scopeCaseId: z.string().optional(),
  reservedReportId: z.string().optional(),
  reservationExpiresAt: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
}).passthrough();

export type PreparationPackEntitlement = z.infer<typeof PreparationPackEntitlementSchema>;

export type CheckoutResponse = {
  transactionId: string;
  status: "success";
};

export type PackUnlockResponse = {
  entitlementId: string;
  releasesGranted: number;
  creditsConsumed: number;
  balanceAfter: number;
  idempotentReplay: boolean;
  status: "success";
  message: string;
};

export type CreditSummary = {
  availableCredits: number;
  lifetimePurchased: number;
  lifetimeConsumed: number;
  lifetimeAdjusted: number;
  lifetimeRefunded: number;
  updatedAt: string;
};

export type AccountOverview = {
  profile: {
    displayName: string;
    company: string;
    country: string;
    email: string;
    emailVerified: boolean;
  };
  credits: CreditSummary;
  commerceHold: {
    active: boolean;
    reason: string;
    deficitCredits: number;
  };
  preparationPacks: {
    activeCount: number;
    releasesRemaining: number;
  };
};

export type AccountCreditLedgerEntry = {
  entryId: string;
  amount: number;
  type: "PURCHASE" | "PACK_UNLOCK" | "ADMIN_ADJUSTMENT" | "REFUND";
  reason: string;
  createdAt: string;
  balanceAfter: number;
  orderId?: string;
  transactionId?: string;
  caseId?: string;
  entitlementId?: string;
};

export type PurchaseHistoryEntry = {
  orderId: string;
  productCode: string;
  status: string;
  currency: string;
  amountMinor: number;
  paddleTransactionId?: string;
  createdAt: string;
  updatedAt: string;
};
