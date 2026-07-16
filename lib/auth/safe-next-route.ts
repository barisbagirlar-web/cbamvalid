export function resolveSafeNextRoute(value: string | null | undefined, fallback = "/cbam"): string {
  if (!value) return fallback;
  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    candidate.includes("\u0000") ||
    candidate.includes("://") ||
    candidate.toLowerCase().startsWith("/javascript:")
  ) {
    return fallback;
  }
  return candidate;
}
