/**
 * A client-safe, environment-agnostic RFC 4122 Version 4 compliant UUID generator.
 * Works inside secure contexts (HTTPS, localhost) and insecure contexts alike,
 * as well as server-side and client-side (including older browsers/webviews).
 */
/**
 * A client-safe, environment-agnostic RFC 4122 Version 4 compliant UUID generator.
 * Works inside secure contexts (HTTPS, localhost) and insecure contexts alike,
 * as well as server-side and client-side (including older browsers/webviews).
 *
 * @euRef "CBAMValid internal — UUID generation, no regulatory basis"
 */
export function safeRandomUUID(): string {
  // 1. Browser/Native secure context support
  if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  // 2. Node.js native support
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // 3. Fallback mathematically conforming to RFC 4122 v4 pattern
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const randomByte = (Math.random() * 16) | 0;
    const value = char === "x" ? randomByte : (randomByte & 0x3) | 0x8;
    return value.toString(16);
  });
}
