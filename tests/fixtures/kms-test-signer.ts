/**
 * Deterministic KMS-signature fixture for tests.
 *
 * Production seals use real Google KMS; tests need a signature that is
 * byte-stable across runs so regenerated sample packages are identical. Using
 * a fixed test key pair keeps createSignature deterministic.
 */
import crypto from "node:crypto";
import type { KmsSignatureResult } from "../../functions/src/cbam/report/kms-signature";

const TEST_PRIVATE_KEY_PEM =
  "-----BEGIN PRIVATE KEY-----\n" +
  "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC2bAbYz5lS0j27\n" +
  "1iIuIOHz1WIqTikXObwsnHyRpi1CC7R4Ubzmt/KuG1EV1eCjM50sgFkzIwNH/SCA\n" +
  "7jLjZEEIerr9Jmt7bBdejxIUHANsHKLKEbFZGz6jQhornWLVltzbNt4Fg1gX6LGd\n" +
  "xDbQaLO8EOZ9mATRTYJruMCpP+39afLloSDCboiRdWyCa3G9OTlkcHbaOON8Sjej\n" +
  "hC5Oux4dPXCirnkzIOKlx/yfsR3eSSSKNLE6pmEsT/Ud9pDwLMr2gVUH3fGou2t1\n" +
  "lDgHTEWDWNO/ENgi+pNjJp3t+2G8s96JnHjP0G2p20rIVWW+/VehPfo4GZykDh5R\n" +
  "ejKqC6TVAgMBAAECggEAB3irhnQTj1uoBp+cZ8TrVt1togDwguXXn1Ygw1BfOH4a\n" +
  "kUumZSax4aVMcAysoNKLhJfpz1kxmGBgKpesQuRHcO2h50i3DJIz734ERgmTBE8J\n" +
  "8HptXT0V7CwtaTg5ejkDE6wOx4KxIs2M1MLatzTKmRByIuu31XYLZOu8tvyKJp+q\n" +
  "CKhwIG3ALYvG7rOyI+RFuyfS9+lfErOK069/m1aUdcf77D958VSDxq1AGwzZQTAz\n" +
  "8GY/Lz/9aWYdFtfSwY5KzKlVPrOnigIAqkYTlE6ODvxRlmakjfgAR3+8w1NBuT3a\n" +
  "0aXfOe6NTqu2Sm3bc2ETWW6NN27z1GMDo6YDK6rxQwKBgQDhtpbyfoKKh3OpnO3M\n" +
  "OErCZympbeGMDcsYzYTl+8kA3ecwbwagqcKFqBWRoJcpAzm5fLc21qQ3c2YGYFcK\n" +
  "EgM0pNTua0aQMyU6zEi5tmgP+3lKR6ywk6JVosRVB2OXcJgsd4I0VLFS47n9vQmY\n" +
  "n0/D5Rb6ije5akNAPFHGu4mSqwKBgQDO5ln7UQQENcmzBMb05Nq5/x1+XgzjOixA\n" +
  "6RKhqE29hVzcHcbjSN4zvUTq3U/AC/WbeiKkYypM0JBs1FSd7ZexyowoTBrtIpdh\n" +
  "tHZgyv1B9RKF+uwE6aB6tiEuz1n/wTA2DWUqAGVrkP0see6NgKe0p3tDdbkCtuwa\n" +
  "V/P3mxOmfwKBgQC8V33xbvtC2O/8kkQjar2HJkovZM8V7NSSJ7xDpCv/myq00ZA4\n" +
  "NC9rE+ybjeNUh6p9SsIe8lApLRPvMiiu8ITYQsqi/8TrwqHIRHpS7RA8ddypzNEe\n" +
  "rrKAvscRJI9H6N4yDK8LN7iXsAqc3kbJofYPQnRAL2F8SF1BlpOuPwL27QKBgDzZ\n" +
  "DhmVSAMc9obJnuGi9JjC6J+jdVLWZvFoGmyknMhiEl9B+p4Zbg/1V/FiyPOIEOF6\n" +
  "1/lUmLoilHcNMx2HJJfLI9EuILUg+Tho5G+vAzCErL/ufb8sHmA4dCXaIXPQEyey\n" +
  "ZNAncaxi5bJQ4dGHxsqgfuXmF1UvCtzshPmLCAptAoGBAK+ZQTHvp40bWl7zQa6z\n" +
  "dzc+ov4hFwH2PaitxWvPR7LJ8CG14K36FcqXkIo9szLt/koOTSNRlpmf/1A8r9eT\n" +
  "IRaLsQ3+JYt62Nw6wcynpxtwvz69I7Ls5UxOGBkV5dcsorntl0CDDaubqw6Vz5LJ\n" +
  "ofE6Y5RpnDbFkWdNArKHjI63\n" +
  "-----END PRIVATE KEY-----\n";

const TEST_PUBLIC_KEY_PEM =
  "-----BEGIN PUBLIC KEY-----\n" +
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtmwG2M+ZUtI9u9YiLiDh\n" +
  "89ViKk4pFzm8LJx8kaYtQgu0eFG85rfyrhtRFdXgozOdLIBZMyMDR/0ggO4y42RB\n" +
  "CHq6/SZre2wXXo8SFBwDbByiyhGxWRs+o0IaK51i1Zbc2zbeBYNYF+ixncQ20Giz\n" +
  "vBDmfZgE0U2Ca7jAqT/t/Wny5aEgwm6IkXVsgmtxvTk5ZHB22jjjfEo3o4QuTrse\n" +
  "HT1woq55MyDipcf8n7Ed3kkkijSxOqZhLE/1HfaQ8CzK9oFVB93xqLtrdZQ4B0xF\n" +
  "g1jTvxDYIvqTYyad7fthvLPeiZx4z9BtqdtKyFVlvv1XoT36OBmcpA4eUXoyqguk\n" +
  "1QIDAQAB\n" +
  "-----END PUBLIC KEY-----\n";

export function createSignature(manifestBytes: Buffer): KmsSignatureResult {
  const manifestHash = crypto.createHash("sha256").update(manifestBytes).digest("hex");
  const signature = crypto.sign("sha256", manifestBytes, TEST_PRIVATE_KEY_PEM);
  return {
    keyVersion: "projects/test/locations/europe-west1/keyRings/cbam/cryptoKeys/manifest/cryptoKeyVersions/1",
    algorithm: "RSA_SIGN_PKCS1_2048_SHA256",
    manifestHash,
    signatureBase64: signature.toString("base64"),
    publicKeyPem: TEST_PUBLIC_KEY_PEM,
    protectionLevel: "SOFTWARE",
  };
}
