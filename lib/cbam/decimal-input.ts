export function normalizeUnsignedDecimalInput(rawValue: string): string | null {
  const normalized = rawValue.trim().replace(",", ".");
  if (normalized === "") return "";
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  return normalized;
}
