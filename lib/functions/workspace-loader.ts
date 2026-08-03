"use client";

import type { AuditReadyCase } from "@/lib/cbam/schema";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  getCase,
  getEntitlements,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";

const CASE_MEMORY_TTL_MS = 30_000;
const ENTITLEMENT_MEMORY_TTL_MS = 10_000;

type Snapshot<T> = {
  ownerUid: string;
  expiresAt: number;
  value: T;
};

type LoadOptions = {
  forceRefresh?: boolean;
};

type EntitlementInflight = {
  ownerUid: string;
  promise: Promise<PreparationPackEntitlement[]>;
};

const caseSnapshots = new Map<string, Snapshot<AuditReadyCase>>();
const caseInflight = new Map<string, Promise<AuditReadyCase>>();
let entitlementSnapshot: Snapshot<PreparationPackEntitlement[]> | null = null;
let entitlementInflight: EntitlementInflight | null = null;

function currentOwnerUid(): string {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) throw new Error("WORKSPACE_SESSION_REQUIRED");
  return uid;
}

function caseMemoryKey(ownerUid: string, caseId: string): string {
  return `${ownerUid}:${caseId}`;
}

function isFreshForOwner<T>(
  snapshot: Snapshot<T> | null | undefined,
  ownerUid: string
): snapshot is Snapshot<T> {
  return Boolean(
    snapshot &&
    snapshot.ownerUid === ownerUid &&
    snapshot.expiresAt > Date.now()
  );
}

export async function loadWorkspaceCase(
  caseId: string,
  options: LoadOptions = {}
): Promise<AuditReadyCase> {
  const ownerUid = currentOwnerUid();
  const key = caseMemoryKey(ownerUid, caseId);
  const active = caseInflight.get(key);
  if (active) return active;

  const snapshot = caseSnapshots.get(key);
  if (!options.forceRefresh && isFreshForOwner(snapshot, ownerUid)) {
    return snapshot.value;
  }

  const request = getCase(caseId)
    .then((value) => {
      caseSnapshots.set(key, {
        ownerUid,
        value,
        expiresAt: Date.now() + CASE_MEMORY_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      caseInflight.delete(key);
    });

  caseInflight.set(key, request);
  return request;
}

export async function loadWorkspaceEntitlements(
  options: LoadOptions = {}
): Promise<PreparationPackEntitlement[]> {
  const ownerUid = currentOwnerUid();
  if (entitlementInflight?.ownerUid === ownerUid) {
    return entitlementInflight.promise;
  }
  if (!options.forceRefresh && isFreshForOwner(entitlementSnapshot, ownerUid)) {
    return entitlementSnapshot.value;
  }

  const promise = getEntitlements()
    .then((value) => {
      entitlementSnapshot = {
        ownerUid,
        value,
        expiresAt: Date.now() + ENTITLEMENT_MEMORY_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      if (entitlementInflight?.ownerUid === ownerUid) {
        entitlementInflight = null;
      }
    });

  entitlementInflight = { ownerUid, promise };
  return promise;
}

export function seedWorkspaceCase(caseId: string, value: AuditReadyCase): void {
  const ownerUid = currentOwnerUid();
  caseSnapshots.set(caseMemoryKey(ownerUid, caseId), {
    ownerUid,
    value,
    expiresAt: Date.now() + CASE_MEMORY_TTL_MS,
  });
}

export function prewarmCaseWorkspace(caseId: string): void {
  void Promise.allSettled([
    loadWorkspaceCase(caseId, { forceRefresh: true }),
    loadWorkspaceEntitlements({ forceRefresh: true }),
  ]);
}

export function invalidateWorkspaceCase(caseId: string): void {
  const ownerUid = firebaseAuth.currentUser?.uid;
  if (!ownerUid) return;
  caseSnapshots.delete(caseMemoryKey(ownerUid, caseId));
}

export function invalidateWorkspaceEntitlements(): void {
  entitlementSnapshot = null;
}
