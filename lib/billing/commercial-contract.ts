import { z } from "zod";
import rawContract from "@/config/cbam-commercial-product.json";

const CommercialContractSchema = z.object({
  schemaVersion: z.literal("CBAMVALID-COMMERCE-1.0"),
  productCode: z.literal("CBAM_EXPORTER_FINAL_REPORT"),
  slug: z.string().min(1),
  displayName: z.string().min(1),
  currency: z.literal("USD"),
  priceMinor: z.number().int().positive(),
  creditsGranted: z.number().int().positive(),
  creditsRequiredToUnlock: z.number().int().positive(),
  releasesPerPack: z.number().int().positive(),
  subscription: z.literal(false),
  correctionWindowDays: z.number().int().nonnegative(),
  maxCustomsLines: z.number().int().positive(),
  maxInstallations: z.number().int().positive(),
  maxCnCodes: z.number().int().positive(),
  active: z.literal(true),
}).superRefine((value, context) => {
  if (value.creditsGranted !== value.creditsRequiredToUnlock) {
    context.addIssue({ code: "custom", message: "Purchased credits must unlock exactly one Preparation Pack." });
  }
});

export const COMMERCIAL_CONTRACT = CommercialContractSchema.parse(rawContract);
export type CommercialContract = z.infer<typeof CommercialContractSchema>;

export function formatCommercialPrice(): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: COMMERCIAL_CONTRACT.currency,
    maximumFractionDigits: 0,
  }).format(COMMERCIAL_CONTRACT.priceMinor / 100);
}
