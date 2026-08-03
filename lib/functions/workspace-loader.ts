"use client";

import type { AuditReadyCase } from "@/lib/cbam/schema";
import {
  getCase,
  getEntitlements,
  type PreparationPackEntitlement,
} from "@/lib/functions/client";

const CASE_MEMORY_TTL_MS = 30_000;
const ENTITLEMENT_MEMORY_TTL_MS = 10_000;

type Snapshot<T> = {
  expiresAt: number;
  value: T;
};

type LoadOptions = {
  forceRefresh?: boolean;
};

const caseSnapshots = new Map<string, Snapshot<AuditReadyCase>>();
const caseInflight = new Map<string, Promise<AuditReadyCase>>();
let entitlementSnapshot: Snapshot<PreparationPackEntitlement[]> | null = null;
let entitlementInflight: Promise<PreparationPackEntitlement[]> | null = null;

function isFresh<T>(snapshot: Snapshot<T> | null | undefined): snapshot is Snapshot<T> {
  return Boolean(snapshot && snapshot.expiresAt > Date.now());
}

export async function loadWorkspaceCase(
  caseId: string,
  options: LoadOptions = {}
): Promise<AuditReadyCase> {
  const active = caseInflight.get(caseId);
  if (active) return active;

  const snapshot = caseSnapshots.get(caseId);
  if (!options.forceRefresh && isFresh(snapshot)) return snapshot.value;

  const request = getCase(caseId)
    .then((value) => {
      caseSnapshots.set(caseId, {
        value,
        expiresAt: Date.now() + CASE_MEMORY_TTL_MS,
      });
      return value;
    })
    .finally(() => {
      caseInflight.delete(caseId);
    });

  caseInflight.set(caseId, request);
  return request;
}

export async function loadWorkspaceEntitlements(
  options: LoadOptions = {}
): Promise<PreparationPackEntitlement[]> {
  if (entitlementInflight) return entitlementInflight;
  if (!options.forceRefresh && isFresh(entitlementSnapshot)) {
    return entitlementSnapshot.value;
  }

  entitlementInflight = getEntitlements()
    .then((value) => {
      entitlementSnapshot = {
        value,
        expiresAt: Date.now() + ENTITLEMENT_MEMORY_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      entitlementInflight = null;
    });

  return entitlementInflight;
}

export function seedWorkspaceCase(caseId: string, value: AuditReadyCase): void {
  caseSnapshots.set(caseId, {
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
  caseSnapshots.delete(caseId);
}

export function invalidateWorkspaceEntitlements(): void {
  entitlementSnapshot = null;
}
