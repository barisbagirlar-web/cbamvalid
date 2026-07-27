/** Human package label (e.g. Y7654). API returns packageCode; this formats for UI. */
export const PACKAGE_CODE_PATTERN = /^[A-Z][0-9]{4}$/;

export function formatPackageCode(packageCode?: string | null): string {
  if (typeof packageCode === "string" && PACKAGE_CODE_PATTERN.test(packageCode)) {
    return packageCode;
  }
  return "—";
}
