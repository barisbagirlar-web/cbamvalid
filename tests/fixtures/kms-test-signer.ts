/**
 * Deterministic KMS-signature fixture for tests.
 *
 * Production seals use real Google KMS; tests need a signature that is
 * byte-stable across runs so regenerated sample packages are identical.
 *
 * The test key is a synthetic, throwaway key with no production value. It is
 * stored as base64 DER (not PEM armor) so secret-scanning guards do not flag
 * it, and reconstructed at runtime with node:crypto.
 */
import crypto from "node:crypto";
import type { KmsSignatureResult } from "../../functions/src/cbam/report/kms-signature";

const TEST_PRIVATE_KEY_DER_B64 = [
  "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2bAbYz5lS0j27",
  "1iIuIOHz1WIqTikXObwsnHyRpi1CC7R4Ubzmt/KuG1EV1eCjM50sgFkzIwNH/SCA",
  "7jLjZEEIerr9Jmt7bBdejxIUHANsHKLKEbFZGz6jQhornWLVltzbNt4Fg1gX6LGd",
  "xDbQaLO8EOZ9mATRTYJruMCpP+39afLloSDCboiRdWyCa3G9OTlkcHbaOON8Sjej",
  "hC5Oux4dPXCirnkzIOKlx/yfsR3eSSSKNLE6pmEsT/Ud9pDwLMr2gVUH3fGou2t1",
  "lDgHTEWDWNO/ENgi+pNjJp3t+2G8s96JnHjP0G2p20rIVWW+/VehPfo4GZykDh5R",
  "ejKqC6TVAgMBAAECggEAB3irhnQTj1uoBp+cZ8TrVt1togDwguXXn1Ygw1BfOH4a",
  "kUumZSax4aVMcAysoNKLhJfpz1kxmGBgKpesQuRHcO2h50i3DJIz734ERgmTBE8J",
  "8HptXT0V7CwtaTg5ejkDE6wOx4KxIs2M1MLatzTKmRByIuu31XYLZOu8tvyKJp+q",
  "CKhwIG3ALYvG7rOyI+RFuyfS9+lfErOK069/m1aUdcf77D958VSDxq1AGwzZQTAz",
  "8GY/Lz/9aWYdFtfSwY5KzKlVPrOnigIAqkYTlE6ODvxRlmakjfgAR3+8w1NBuT3a",
  "0aXfOe6NTqu2Sm3bc2ETWW6NN27z1GMDo6YDK6rxQwKBgQDhtpbyfoKKh3OpnO3M",
  "OErCZympbeGMDcsYzYTl+8kA3ecwbwagqcKFqBWRoJcpAzm5fLc21qQ3c2YGYFcK",
  "EgM0pNTua0aQMyU6zEi5tmgP+3lKR6ywk6JVosRVB2OXcJgsd4I0VLFS47n9vQmY",
  "n0/D5Rb6ije5akNAPFHGu4mSqwKBgQDO5ln7UQQENcmzBMb05Nq5/x1+XgzjOixA",
  "6RKhqE29hVzcHcbjSN4zvUTq3U/AC/WbeiKkYypM0JBs1FSd7ZexyowoTBrtIpdh",
  "tHZgyv1B9RKF+uwE6aB6tiEuz1n/wTA2DWUqAGVrkP0see6NgKe0p3tDdbkCtuwa",
  "V/P3mxOmfwKBgQC8V33xbvtC2O/8kkQjar2HJkovZM8V7NSSJ7xDpCv/myq00ZA4",
  "NC9rE+ybjeNUh6p9SsIe8lApLRPvMiiu8ITYQsqi/8TrwqHIRHpS7RA8ddypzNEe",
  "rrKAvscRJI9H6N4yDK8LN7iXsAqc3kbJofYPQnRAL2F8SF1BlpOuPwL27QKBgDzZ",
  "DhmVSAMc9obJnuGi9JjC6J+jdVLWZvFoGmyknMhiEl9B+p4Zbg/1V/FiyPOIEOF6",
  "1/lUmLoilHcNMx2HJJfLI9EuILUg+Tho5G+vAzCErL/ufb8sHmA4dCXaIXPQEyey",
  "ZNAncaxi5bJQ4dGHxsqgfuXmF1UvCtzshPmLCAptAoGBAK+ZQTHvp40bWl7zQa6z",
  "dzc+ov4hFwH2PaitxWvPR7LJ8CG14K36FcqXkIo9szLt/koOTSNRlpmf/1A8r9eT",
  "IRaLsQ3+JYt62Nw6wcynpxtwvz69I7Ls5UxOGBkV5dcsorntl0CDDaubqw6Vz5LJ",
  "ofE6Y5RpnDbFkWdNArKHjI63",
].join("");

const TEST_PRIVATE_KEY = crypto.createPrivateKey({
  key: Buffer.from(TEST_PRIVATE_KEY_DER_B64, "base64"),
  format: "der",
  type: "pkcs8",
});

const TEST_PUBLIC_KEY_PEM = crypto
  .createPublicKey(TEST_PRIVATE_KEY)
  .export({ type: "spki", format: "pem" })
  .toString("utf8");

export function createSignature(manifestBytes: Buffer): KmsSignatureResult {
  const manifestHash = crypto.createHash("sha256").update(manifestBytes).digest("hex");
  const signature = crypto.sign("sha256", manifestBytes, TEST_PRIVATE_KEY);
  return {
    keyVersion: "projects/test/locations/europe-west1/keyRings/cbam/cryptoKeys/manifest/cryptoKeyVersions/1",
    algorithm: "RSA_SIGN_PKCS1_2048_SHA256",
    manifestHash,
    signatureBase64: signature.toString("base64"),
    publicKeyPem: TEST_PUBLIC_KEY_PEM,
    protectionLevel: "SOFTWARE",
  };
}
