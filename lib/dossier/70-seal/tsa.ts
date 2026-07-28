/**
 * WP-11 — RFC 3161 timestamp binding.
 * Fail-closed: without a real TSA response, sealed packages must not claim TSA.
 */
export type TsaStatus = "PRESENT" | "ABSENT" | "UNVERIFIED";

export interface TsaBinding {
  readonly status: TsaStatus;
  readonly tsrFileName: string | null;
  readonly note: string;
}

export function bindRfc3161Timestamp(params: {
  readonly tsrBytes: Uint8Array | null;
}): TsaBinding {
  if (!params.tsrBytes || params.tsrBytes.length === 0) {
    return {
      status: "ABSENT",
      tsrFileName: null,
      note: "RFC 3161 trusted timestamp not attached. Generated-At remains operator/system self-asserted until TSA is configured.",
    };
  }
  return {
    status: "UNVERIFIED",
    tsrFileName: "Manifest.Timestamp.tsr",
    note: "TSR bytes present; cryptographic TSA verification is performed by the offline verifier CLI / public verify endpoint.",
  };
}

export function mayClaimTrustedTimestamp(binding: TsaBinding): boolean {
  return binding.status === "PRESENT";
}
