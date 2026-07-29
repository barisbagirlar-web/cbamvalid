/**
 * Configure CBAMValid Paddle Billing webhook destination + sync Secret Manager.
 *
 * Requires a Paddle API key with notification_setting.read/write.
 *
 * Usage:
 *   PADDLE_API_KEY=pdl_sdbx_... npx tsx scripts/configure-paddle-cbam-webhook.ts
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT = "cbam-desk";
const DEST =
  process.env.PADDLE_WEBHOOK_FUNCTION_URL ||
  "https://europe-west1-cbam-desk.cloudfunctions.net/paddleWebhook";
const API_BASE =
  process.env.PADDLE_API_BASE ||
  (process.env.PADDLE_API_KEY?.startsWith("pdl_live_")
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com");

type NotificationSetting = {
  id?: string;
  destination?: string;
  active?: boolean;
  endpoint_secret_key?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNotificationSetting(value: unknown): value is NotificationSetting {
  if (!isRecord(value)) return false;
  return (
    (value.id === undefined || typeof value.id === "string") &&
    (value.destination === undefined || typeof value.destination === "string") &&
    (value.active === undefined || typeof value.active === "boolean") &&
    (value.endpoint_secret_key === undefined ||
      typeof value.endpoint_secret_key === "string")
  );
}

async function paddleFetch(path: string, init?: RequestInit) {
  const key = process.env.PADDLE_API_KEY || "";
  if (!key) throw new Error("PADDLE_API_KEY is required");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = text ? JSON.parse(text) : {};
    body = isRecord(parsed) ? parsed : { raw: text };
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log("API_BASE=", API_BASE);
  console.log("DEST=", DEST);

  const list = await paddleFetch("/notification-settings?per_page=50");
  if (!list.ok) {
    console.error("LIST_FAILED", list.status, list.body);
    process.exit(1);
  }

  const rows = Array.isArray(list.body.data)
    ? list.body.data.filter(isNotificationSetting)
    : [];
  const existing = rows.find(
    (row) =>
      String(row.destination || "").includes("cbam-desk") ||
      String(row.destination || "").includes("cbamvalid")
  );

  let setting: NotificationSetting | undefined = existing;
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
        description: "CBAMValid fulfillment",
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
        "Create a Paddle API key with notification_setting.write in Developer Tools > Authentication, then re-run."
      );
      process.exit(1);
    }
    setting = isNotificationSetting(created.body.data)
      ? created.body.data
      : undefined;
    if (!setting) {
      console.error("CREATE_FAILED_INVALID_RESPONSE", created.body);
      process.exit(1);
    }
    console.log("CREATED", setting.id);
  } else if (!existing.active || existing.destination !== DEST) {
    const patched = await paddleFetch(`/notification-settings/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        description: "CBAMValid fulfillment",
        destination: DEST,
        active: true,
        subscribed_events: eventNames,
      }),
    });
    if (!patched.ok) {
      console.error("PATCH_FAILED", patched.status, JSON.stringify(patched.body, null, 2));
      process.exit(1);
    }
    setting = isNotificationSetting(patched.body.data)
      ? patched.body.data
      : undefined;
    if (!setting) {
      console.error("PATCH_FAILED_INVALID_RESPONSE", patched.body);
      process.exit(1);
    }
    console.log("UPDATED", setting.id);
  } else {
    console.log("ALREADY_CONFIGURED", existing.id);
  }

  const secret = setting?.endpoint_secret_key;
  if (!secret) {
    console.error("Missing endpoint_secret_key on notification setting");
    process.exit(1);
  }

  console.log("ENDPOINT_SECRET_PREFIX=", String(secret).slice(0, 12));
  const tmp = join(tmpdir(), `paddle-webhook-secret-${Date.now()}.txt`);
  try {
    writeFileSync(tmp, String(secret), { mode: 0o600 });
    execFileSync(
      "gcloud",
      ["secrets", "versions", "add", "PADDLE_WEBHOOK_SECRET", `--project=${PROJECT}`, `--data-file=${tmp}`],
      { stdio: "inherit" }
    );
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
  console.log("Secret Manager PADDLE_WEBHOOK_SECRET updated.");
  console.log("Redeploy paddleWebhook so it mounts the new secret version if needed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
