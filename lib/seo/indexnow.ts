/**
 * IndexNow key for Bing / Yandex / Seznam instant URL notification.
 * Public file must live at /{INDEXNOW_KEY}.txt with the same key body.
 * https://www.indexnow.org/documentation
 */
export const INDEXNOW_KEY = "cbamvalid-aeo-indexnow-7f3c9e2a";

export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;

export const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
] as const;
