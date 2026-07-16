import { z } from "zod";
import { getPriceIdForProduct, getProduct } from "./catalog";

const CustomDataSchema = z.object({
  uid: z.string().min(1).max(128),
  orderId: z.string().regex(/^ord_[a-f0-9]{64}$/),
  productCode: z.literal("CBAM_CREDIT_PACK_5"),
  caseId: z.string().min(1).max(128).optional(),
  environment: z.enum(["sandbox", "production"]),
});

const ItemSchema = z.object({
  quantity: z.number().int().positive().max(10),
  price: z.object({ id: z.string().min(1) }).passthrough(),
}).passthrough();

const CompletedTransactionSchema = z.object({
  id: z.string().min(1).max(128),
  status: z.literal("completed"),
  currencyCode: z.string().length(3),
  customData: CustomDataSchema,
  items: z.array(ItemSchema).min(1).max(10),
  details: z.object({
    totals: z.object({ total: z.union([z.string(), z.number()]) }).passthrough(),
  }).passthrough(),
}).passthrough();

export type ValidatedCompletedTransaction = {
  transactionId: string;
  uid: string;
  orderId: string;
  caseId?: string;
  productCode: "CBAM_CREDIT_PACK_5";
  currency: string;
  totalMinor: number;
  quantity: number;
  priceId: string;
};

function minorAmount(value: string | number): number {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw new Error("PADDLE_TOTAL_INVALID");
  const amount = Number(text);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("PADDLE_TOTAL_INVALID");
  return amount;
}

export function validateCompletedTransaction(
  input: unknown,
  expectedSandbox: boolean
): ValidatedCompletedTransaction {
  const transaction = CompletedTransactionSchema.parse(input);
  const product = getProduct(transaction.customData.productCode);
  if (!product) throw new Error("PADDLE_PRODUCT_INVALID");

  const expectedEnvironment = expectedSandbox ? "sandbox" : "production";
  if (transaction.customData.environment !== expectedEnvironment) {
    throw new Error("PADDLE_ENVIRONMENT_MISMATCH");
  }
  if (transaction.currencyCode !== product.currency) {
    throw new Error(`PADDLE_CURRENCY_MISMATCH:${product.currency}:${transaction.currencyCode}`);
  }

  const expectedPriceId = getPriceIdForProduct(product.productCode, expectedSandbox);
  if (!expectedPriceId) throw new Error("PADDLE_PRICE_MAPPING_MISSING");
  const quantity = transaction.items.reduce((sum, item) => sum + item.quantity, 0);
  if (quantity !== 1) throw new Error(`PADDLE_QUANTITY_INVALID:${quantity}`);
  const mismatchedItem = transaction.items.find((item) => item.price.id !== expectedPriceId);
  if (mismatchedItem) throw new Error("PADDLE_PRICE_ID_MISMATCH");

  const totalMinor = minorAmount(transaction.details.totals.total);
  const expectedTotal = product.expectedUnitAmount * quantity;
  if (totalMinor !== expectedTotal) {
    throw new Error(`PADDLE_AMOUNT_MISMATCH:${expectedTotal}:${totalMinor}`);
  }

  return {
    transactionId: transaction.id,
    uid: transaction.customData.uid,
    orderId: transaction.customData.orderId,
    ...(transaction.customData.caseId ? { caseId: transaction.customData.caseId } : {}),
    productCode: transaction.customData.productCode,
    currency: transaction.currencyCode,
    totalMinor,
    quantity,
    priceId: expectedPriceId,
  };
}
