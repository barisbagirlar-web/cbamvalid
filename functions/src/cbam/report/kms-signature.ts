import crypto from "node:crypto";
import { getApp } from "firebase-admin/app";

export type KmsSignatureResult = {
  keyVersion: string;
  algorithm: string;
  manifestHash: string;
  signatureBase64: string;
  publicKeyPem: string;
  protectionLevel: string;
};

function requiredKeyVersion(): string {
  const keyVersion = process.env.CBAM_KMS_KEY_VERSION?.trim() || "";
  if (!/^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+\/cryptoKeyVersions\/\d+$/.test(keyVersion)) {
    throw new Error("CBAM_KMS_KEY_VERSION_REQUIRED");
  }
  return keyVersion;
}

async function accessToken(): Promise<string> {
  const credential = getApp().options.credential;
  if (!credential) throw new Error("GOOGLE_APPLICATION_CREDENTIAL_REQUIRED");
  const token = await credential.getAccessToken();
  if (!token.access_token) throw new Error("GOOGLE_ACCESS_TOKEN_MISSING");
  return token.access_token;
}

async function kmsRequest<T>(url: string, init: RequestInit, token: string): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(`KMS_REQUEST_FAILED:${payload.error?.message || response.status}`);
  return payload;
}

const DETERMINISTIC_ALGORITHMS: readonly RegExp[] = [
  // PKCS#1 v1.5 (legacy) remains verifiable for packages sealed before the
  // G-19 PSS migration.
  /^RSA_SIGN_PKCS1_(2048|3072|4096)_SHA256$/,
  // G-19: RSA-4096 PSS (RFC 8017 §8.1). Google Cloud KMS produces PSS
  // signatures with a fixed salt (digest length) so the signature is
  // deterministic, which keeps idempotent sealing intact.
  /^RSA_SIGN_PSS_4096_SHA256$/,
];

function assertDeterministicAlgorithm(algorithm: string): void {
  if (!DETERMINISTIC_ALGORITHMS.some((pattern) => pattern.test(algorithm))) {
    throw new Error(`KMS_ALGORITHM_NOT_DETERMINISTIC_FOR_IDEMPOTENT_SEALING:${algorithm}`);
  }
}

const PSS_SALT_LENGTH = 32;

/**
 * Schema-aware manifest signature verification. The manifest records the KMS
 * algorithm; PKCS#1 v1.5 packages sealed before the G-19 migration keep
 * verifying under the legacy path while new packages verify under PSS.
 */
export function verifyManifestSignature(params: {
  algorithm: string;
  manifest: Buffer;
  publicKeyPem: string;
  signatureBase64: string;
}): boolean {
  const signature = Buffer.from(params.signatureBase64, "base64");
  if (/^RSA_SIGN_PSS_/.test(params.algorithm)) {
    return crypto.verify(
      "sha256",
      params.manifest,
      { key: params.publicKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: PSS_SALT_LENGTH },
      signature
    );
  }
  return crypto.verify("sha256", params.manifest, params.publicKeyPem, signature);
}

export function assertKmsSigningConfigured(): string {
  return requiredKeyVersion();
}

export async function signManifestWithKms(manifest: Buffer): Promise<KmsSignatureResult> {
  const keyVersion = requiredKeyVersion();
  const token = await accessToken();
  const baseUrl = `https://cloudkms.googleapis.com/v1/${keyVersion}`;
  const publicKey = await kmsRequest<{ pem: string; algorithm: string }>(`${baseUrl}/publicKey`, { method: "GET" }, token);
  if (!publicKey.pem || !publicKey.algorithm) throw new Error("KMS_PUBLIC_KEY_INVALID");
  assertDeterministicAlgorithm(publicKey.algorithm);

  const manifestHash = crypto.createHash("sha256").update(manifest).digest("hex");
  const signed = await kmsRequest<{ signature: string }>(`${baseUrl}:asymmetricSign`, {
    method: "POST",
    body: JSON.stringify({ digest: { sha256: Buffer.from(manifestHash, "hex").toString("base64") } }),
  }, token);
  if (!signed.signature) throw new Error("KMS_SIGNATURE_MISSING");

  if (!verifyManifestSignature({
    algorithm: publicKey.algorithm,
    manifest,
    publicKeyPem: publicKey.pem,
    signatureBase64: signed.signature,
  })) {
    throw new Error("KMS_SIGNATURE_VERIFICATION_FAILED");
  }

  let protectionLevel = "UNKNOWN";
  try {
    const versionMeta = await kmsRequest<{ protectionLevel?: string }>(baseUrl, { method: "GET" }, token);
    protectionLevel = versionMeta.protectionLevel || "UNKNOWN";
  } catch {
    protectionLevel = "UNKNOWN";
  }

  return {
    keyVersion,
    algorithm: publicKey.algorithm,
    manifestHash,
    signatureBase64: signed.signature,
    publicKeyPem: publicKey.pem,
    protectionLevel,
  };
}
