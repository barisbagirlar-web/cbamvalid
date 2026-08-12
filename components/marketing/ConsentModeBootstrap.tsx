import { headers } from "next/headers";
import { buildConsentModeBootstrapScript } from "./consent-mode";

export async function ConsentModeBootstrap() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      id="cbamvalid-consent-mode-v2"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: buildConsentModeBootstrapScript() }}
    />
  );
}
