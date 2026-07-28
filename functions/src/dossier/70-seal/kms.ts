/**
 * KMS claim surface for dossier seal layer.
 * Algorithm migration policy: new keys prefer PSS/P384; PKCS#1 v1.5 kept for legacy verify.
 */
import { buildCryptoClaims, type CryptoClaimSet, type KmsProtectionLevel } from "./crypto-claims";

export type PreferredNewKeyAlgorithm = "RSA_SIGN_PSS_4096_SHA256" | "EC_SIGN_P384_SHA384";
export const PREFERRED_NEW_KEY_ALGORITHMS: readonly PreferredNewKeyAlgorithm[] = [
  "RSA_SIGN_PSS_4096_SHA256",
  "EC_SIGN_P384_SHA384",
];

export function isLegacyPkcs1Algorithm(algorithm: string): boolean {
  return /^RSA_SIGN_PKCS1_(2048|3072|4096)_SHA256$/.test(algorithm);
}

export function claimsFromKms(params: {
  protectionLevel: KmsProtectionLevel | string | null | undefined;
  componentCount: number;
  algorithm: string;
  publicVerificationUrl?: string | null;
}): CryptoClaimSet & { readonly algorithmPrinted: string; readonly legacyPkcs1: boolean } {
  const claims = buildCryptoClaims({
    protectionLevel: params.protectionLevel,
    componentCount: params.componentCount,
    publicVerificationUrl: params.publicVerificationUrl,
  });
  return {
    ...claims,
    algorithmPrinted: params.algorithm,
    legacyPkcs1: isLegacyPkcs1Algorithm(params.algorithm),
  };
}
