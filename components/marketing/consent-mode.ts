export const ANALYTICS_CONSENT_KEY = "cbamvalid_analytics_consent";

export const CONSENT_MODE_V2_KEYS = [
  "analytics_storage",
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
] as const;

export type ConsentChoice = "granted" | "denied";

export function consentModeUpdate(choice: ConsentChoice) {
  return {
    analytics_storage: choice,
    ad_storage: "denied" as const,
    ad_user_data: "denied" as const,
    ad_personalization: "denied" as const,
  };
}

export function buildConsentModeBootstrapScript(): string {
  return `(function(){try{var k=${JSON.stringify(ANALYTICS_CONSENT_KEY)};window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',wait_for_update:500});var c=window.localStorage.getItem(k);if(c==='granted'){window.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});}else if(c==='denied'){window.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});}window.__cbamConsentModeV2={version:2,choice:c==='granted'||c==='denied'?c:'unset',defaultDenied:true};}catch(e){window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});window.__cbamConsentModeV2={version:2,choice:'unset',defaultDenied:true,error:'storage-unavailable'};}})();`;
}

declare global {
  interface Window {
    __cbamConsentModeV2?: {
      version: 2;
      choice: "granted" | "denied" | "unset";
      defaultDenied: true;
      error?: string;
    };
  }
}
