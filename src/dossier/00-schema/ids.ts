/**
 * Deterministic CalcNodeId constructor — never truncate, never stringify undefined.
 */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type CalcNodeId = Brand<string, "CalcNodeId">;
export type ReqId = Brand<string, "ReqId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type Sha256 = Brand<string, "Sha256">;

const NODE_ID_RE = /^CBAM\.[A-Z]+(\.[A-Z0-9_]+)*$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

export function nodeId(...segments: string[]): CalcNodeId {
  if (segments.length === 0) throw new Error("CalcNodeId requires at least one segment");
  for (const segment of segments) {
    if (segment === undefined || segment === null || segment === "") {
      throw new Error(`CalcNodeId segment empty: ${JSON.stringify(segments)}`);
    }
    if (typeof segment !== "string") {
      throw new Error(`CalcNodeId segment not string: ${JSON.stringify(segments)}`);
    }
  }
  const id = ["CBAM", ...segments].join(".");
  if (!NODE_ID_RE.test(id)) throw new Error(`Invalid CalcNodeId: ${id}`);
  return id as CalcNodeId;
}

export function sha256Brand(hex: string): Sha256 {
  const normalized = hex.toLowerCase();
  if (!SHA256_RE.test(normalized)) throw new Error(`Invalid Sha256: ${hex}`);
  return normalized as Sha256;
}

/** Canonical ID helpers used by the calculation graph. */
export const NodeIds = {
  dirInstallation: () => nodeId("DIR", "INSTALLATION"),
  indInstallation: () => nodeId("IND", "INSTALLATION"),
  totalPriced: () => nodeId("TOTAL", "PRICED"),
  totalDisclosed: () => nodeId("TOTAL", "DISCLOSED"),
  goodEeDirect: (index: number) => nodeId("GOOD", String(index), "EE_DIRECT"),
  goodEeIndirect: (index: number) => nodeId("GOOD", String(index), "EE_INDIRECT"),
  goodSeePriced: (index: number) => nodeId("GOOD", String(index), "SEE_PRICED"),
  goodSeeDirect: (index: number) => nodeId("GOOD", String(index), "SEE_DIRECT"),
  goodSeeIndirect: (index: number) => nodeId("GOOD", String(index), "SEE_INDIRECT"),
} as const;
