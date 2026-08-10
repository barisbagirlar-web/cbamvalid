import { buildConsentModeBootstrapScript } from "./consent-mode";

export function ConsentModeBootstrap() {
  return (
    <script
      id="cbamvalid-consent-mode-v2"
      dangerouslySetInnerHTML={{ __html: buildConsentModeBootstrapScript() }}
    />
  );
}
