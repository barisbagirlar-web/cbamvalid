export function resolveAppCheckEnforcement(
  configuredValue: string | undefined,
  isEmulator: boolean
): boolean {
  if (isEmulator) return false;

  // App Check is enabled only after the web app has a registered provider and
  // the matching public site key is present in the Hosting build environment.
  // Firebase Authentication remains mandatory for every callable either way.
  return configuredValue === "true";
}
