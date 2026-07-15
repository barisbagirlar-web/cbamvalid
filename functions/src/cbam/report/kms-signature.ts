import crypto from "node:crypto";
import { getApp } from "firebase-admin/app";

export type KmsSignatureResult = {
  keyVersion: string;
  algorithm: string;
  manifestHash: string;
  signatureBase64: string;
  publicKeyPem: string;
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

export function assertKmsSigningConfigured(): string {
  return requiredKeyVersion();
}

export async function signManifestWithKms(manifest: Buffer): Promise<KmsSignatureResult> {
  const keyVersion = requiredKeyVersion();
  const token = await accessToken();
  const baseUrl = `https://cloudkms.googleapis.com/v1/${keyVersion}`;
  const publicKey = await kmsRequest<{ pem: string; algorithm: string }>(`${baseUrl}/publicKey`, { method: "GET" }, token);
  if (!publicKey.pem || !publicKey.algorithm) throw new Error("KMS_PUBLIC_KEY_INVALID");

  const manifestHash = crypto.createHash("sha256").update(manifest).digest("hex");
  const signed = await kmsRequest<{ signature: string }>(`${baseUrl}:asymmetricSign`, {
    method: "POST",
    body: JSON.stringify({
      digest: { sha256: Buffer.from(manifestHash, "hex").toString("base64") },
    }),
  }, token);
  if (!signed.signature) throw new Error("KMS_SIGNATURE_MISSING");

  const signature = Buffer.from(signed.signature, "base64");
  const verified = crypto.verify("sha256", manifest, publicKey.pem, signature);
  if (!verified) throw new Error("KMS_SIGNATURE_VERIFICATION_FAILED");

  return {
    keyVersion,
    algorithm: publicKey.algorithm,
    manifestHash,
    signatureBase64: signed.signature,
    publicKeyPem: publicKey.pem,
  };
}
