import { httpsCallable } from "firebase/functions";
import { firebaseFunctions } from "@/lib/firebase/client";
import type {
  AccountCreditLedgerEntry,
  AccountOverview,
  PurchaseHistoryEntry,
} from "@/lib/functions/commerce-types";

const getAccountOverviewCallable = httpsCallable<void, AccountOverview>(
  firebaseFunctions,
  "getAccountOverview"
);
const listCreditLedgerCallable = httpsCallable<
  { limit?: number },
  { ledger: AccountCreditLedgerEntry[] }
>(firebaseFunctions, "listCreditLedger");
const listPurchaseHistoryCallable = httpsCallable<
  { limit?: number },
  { history: PurchaseHistoryEntry[] }
>(firebaseFunctions, "listPurchaseHistory");
const requestAccountClosureCallable = httpsCallable<void, { success: true }>(
  firebaseFunctions,
  "requestAccountClosure"
);

export async function getTypedAccountOverview(): Promise<AccountOverview> {
  return (await getAccountOverviewCallable()).data;
}

export async function getTypedCreditLedger(limit = 50): Promise<AccountCreditLedgerEntry[]> {
  return (await listCreditLedgerCallable({ limit })).data.ledger;
}

export async function getTypedPurchaseHistory(limit = 50): Promise<PurchaseHistoryEntry[]> {
  return (await listPurchaseHistoryCallable({ limit })).data.history;
}

export async function submitAccountClosure(): Promise<void> {
  await requestAccountClosureCallable();
}
