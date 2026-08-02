/**
 * Configure the CBAMValid Paddle Billing webhook destination and sync its
 * endpoint secret to Google Secret Manager.
 *
 * Required:
 *   FIREBASE_PROJECT=cbam-desk-sandbox|cbam-desk
 *   PADDLE_API_KEY=pdl_sdbx_...|pdl_live_...
 *
 * Optional:
 *   FUNCTIONS_REGION=europe-west1
 *   PADDLE_WEBHOOK_FUNCTION_URL=https://...
 *   PADDLE_API_BASE=https://sandbox-api.paddle.com|https://api.paddle.com
 *
 * Safety contract:
 *   - sandbox Paddle credentials may only target cbam-desk-sandbox
 *   - live Paddle credentials may only target cbam-desk
 *   - endpoint secrets are never printed
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT = String(
  process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || ""
).trim();
const REGION = String(process.env.FUNCTIONS_REGION || "europe-west1").trim();
const API_KEY = String(process.env.PADDLE_API_KEY || "").trim();
const IS_SANDBOX = API_KEY.startsWith("pdl_sdbx_");
const IS_LIVE = API_KEY.startsWith("pdl_live_");
const EXPECTED_PROJECT = IS_SANDBOX ? "cbam-desk-sandbox" : "cbam-desk";
const DEFAULT_API_BASE = IS_SANDBOX
  ? "https://sandbox-api.paddle.com"
  : "https://api.paddle.com";
const API_BASE = String(process.env.PADDLE_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
const DEST =
  process.env.PADDLE_WEBHOOK_FUNCTION_URL ||
  `https://${REGION}-${PROJECT}.cloudfunctions.net/paddleWebhook`;
const SECRET_NAME = "PADDLE_WEBHOOK_SECRET";

function assertSafeConfiguration() {
  if (!PROJECT) {
    throw new Error("FIREBASE_PROJECT is required.");
  }
  if (PROJECT !== "cbam-desk" && PROJECT !== "cbam-desk-sandbox") {
    throw new Error(`Unsupported Firebase project: ${PROJECT}`);
  }
  if (!IS_SANDBOX && !IS_LIVE) {
    throw new Error("PADDLE_API_KEY must start with pdl_sdbx_ or pdl_live_.");
  }
  if (PROJECT !== EXPECTED_PROJECT) {
    throw new Error(
      `Paddle credential/project mismatch: ${IS_SANDBOX ? "sandbox" : "live"} credentials require ${EXPECTED_PROJECT}.`
    );
  }
  if (API_BASE !== DEFAULT_API_BASE) {
    throw new Error(
      `PADDLE_API_BASE mismatch: expected ${DEFAULT_API_BASE} for the supplied credential.`
    );
  }
  const expectedHost = `${REGION}-${PROJECT}.cloudfunctions.net`;
  if (!process.env.PADDLE_WEBHOOK_FUNCTION_URL && !DEST.includes(expectedHost)) {
    throw new Error(`Derived webhook destination is invalid: ${DEST}`);
  }
}

async function paddleFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: Record<string, any> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

function ensureSecretExists() {
  try {
    execFileSync(
      "gcloud",
      ["secrets", "describe", SECRET_NAME, `--project=${PROJECT}`],
      { stdio: "ignore" }
    );
  } catch {
    execFileSync(
      "gcloud",
      [
        "secrets",
        "create",
        SECRET_NAME,
        `--project=${PROJECT}`,
        "--replication-policy=automatic",
      ],
      { stdio: "inherit" }
    );
  }
}

async function main() {
  assertSafeConfiguration();
  console.log(`PADDLE_ENV=${IS_SANDBOX ? "sandbox" : "production"}`);
  console.log(`FIREBASE_PROJECT=${PROJECT}`);
  console.log(`PADDLE_API_BASE=${API_BASE}`);
  console.log(`PADDLE_WEBHOOK_DESTINATION=${DEST}`);

  const list = await paddleFetch("/notification-settings?per_page=50");
  if (!list.ok) {
    console.error("LIST_FAILED", list.status, list.body);
    process.exit(1);
  }

  const existing = (list.body.data || []).find(
    (row: any) => String(row.destination || "") === DEST
  );

  let setting = existing;
  const eventNames = [
    "transaction.completed",
    "transaction.payment_failed",
    "adjustment.created",
    "adjustment.updated",
  ];

  if (!existing) {
    const created = await paddleFetch("/notification-settings", {
      method: "POST",
      body: JSON.stringify({
        description: `CBAMValid fulfillment (${IS_SANDBOX ? "sandbox" : "live"})`,
        type: "url",
        destination: DEST,
        api_version: 1,
        include_sensitive_fields: false,
        subscribed_events: eventNames,
      }),
    });
    if (!created.ok) {
      console.error("CREATE_FAILED", created.status, JSON.stringify(created.body, null, 2));
      console.error(
        "Create a Paddle API key with notification_setting.read and notification_setting.write, then re-run."
      );
      process.exit(1);
    }
    setting = created.body.data;
    console.log("PADDLE_NOTIFICATION_SETTING=CREATED");
  } else if (!existing.active) {
    const patched = await paddleFetch(`/notification-settings/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        description: `CBAMValid fulfillment (${IS_SANDBOX ? "sandbox" : "live"})`,
        destination: DEST,
        active: true,
        subscribed_events: eventNames,
      }),
    });
    if (!patched.ok) {
      console.error("PATCH_FAILED", patched.status, JSON.stringify(patched.body, null, 2));
      process.exit(1);
    }
    setting = patched.body.data;
    console.log("PADDLE_NOTIFICATION_SETTING=UPDATED");
  } else {
    console.log("PADDLE_NOTIFICATION_SETTING=ALREADY_CONFIGURED");
  }

  const secret = setting?.endpoint_secret_key;
  if (!secret) {
    console.error("Missing endpoint_secret_key on notification setting");
    process.exit(1);
  }

  ensureSecretExists();
  const tmp = join(tmpdir(), `paddle-webhook-secret-${Date.now()}.txt`);
  try {
    writeFileSync(tmp, String(secret), { mode: 0o600 });
    execFileSync(
      "gcloud",
      [
        "secrets",
        "versions",
        "add",
        SECRET_NAME,
        `--project=${PROJECT}`,
        `--data-file=${tmp}`,
      ],
      { stdio: "inherit" }
    );
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
  }

  console.log("PADDLE_WEBHOOK_SECRET=SYNCED");
  console.log("NEXT_ACTION=Redeploy paddleWebhook so the new secret version is mounted.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
