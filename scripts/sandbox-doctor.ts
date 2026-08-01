#!/usr/bin/env npx tsx
/**
 * FAZ P0 (J) — sandbox environment doctor.
 *
 * Diagnoses whether the hosted QA sandbox is fully provisioned and isolated
 * from the cbam-desk production project. Every check reports PASS/FAIL and the
 * script exits non-zero when any required check fails.
 *
 * Checks:
 *  - gcloud authentication
 *  - Firebase authentication
 *  - sandbox project existence (cbam-desk-sandbox)
 *  - Firestore / Storage / Cloud Functions / Cloud Run / Secret Manager / KMS
 *    / Firebase Auth APIs enabled on the sandbox project
 *  - sandbox hosting site
 *  - required environment variables (sandbox config)
 *  - production project isolation (synthetic dossiers must never target cbam-desk)
 *
 * Usage:
 *   npm run sandbox:doctor
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SANDBOX_PROJECT = "cbam-desk-sandbox";
const PRODUCTION_PROJECT = "cbam-desk";
const REQUIRED_APIS = [
  "firestore.googleapis.com",
  "storage-api.googleapis.com",
  "cloudfunctions.googleapis.com",
  "run.googleapis.com",
  "secretmanager.googleapis.com",
  "cloudkms.googleapis.com",
  "identitytoolkit.googleapis.com",
];

const rootDir = process.cwd();
const results: Array<{ check: string; pass: boolean; detail: string }> = [];

function report(check: string, pass: boolean, detail = ""): void {
  results.push({ check, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${check}${detail ? ` — ${detail}` : ""}`);
}

function run(command: string, args: string[], opts: { failOk?: boolean } = {}): string {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    cwd: rootDir,
    timeout: 60_000,
    env: process.env,
  });
  if (result.error && !opts.failOk) {
    throw result.error;
  }
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  return output;
}

function hasFirebaseProjectAlias(): string | null {
  try {
    const firebaserc = JSON.parse(fs.readFileSync(path.join(rootDir, ".firebaserc"), "utf8"));
    const projects = firebaserc?.projects ?? {};
    if (projects.sandbox) return projects.sandbox;
    return null;
  } catch {
    return null;
  }
}

function loadDotEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const file of [".env", ".env.local", ".env.sandbox"]) {
    const full = path.join(rootDir, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !line.trim().startsWith("#")) {
        vars[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
      }
    }
  }
  return vars;
}

function main(): void {
  console.log(`CBAMValid sandbox doctor — sandbox "${SANDBOX_PROJECT}", production "${PRODUCTION_PROJECT}"`);
  console.log("");

  // 1. gcloud authentication
  const gcloudAccounts = run("gcloud", ["auth", "list", "--format=value(account)"], { failOk: true });
  const hasGcloud = gcloudAccounts.length > 0 && !gcloudAccounts.includes("ERROR:");
  report("gcloud authentication", hasGcloud, hasGcloud ? gcloudAccounts.split("\n")[0] : "no credentialed account");

  // 2. Firebase authentication
  const firebaseUsers = run("firebase", ["login:list"], { failOk: true });
  const hasFirebase = /Logged in as|user\s/i.test(firebaseUsers) || !/Error|need to authorize/i.test(firebaseUsers);
  report("firebase authentication", hasFirebase, hasFirebase ? (firebaseUsers.split("\n")[0] ?? "logged in") : "not logged in");

  // 3. Sandbox project existence
  const projectDescribe = run("gcloud", ["projects", "describe", SANDBOX_PROJECT], { failOk: true });
  const projectExists = !projectDescribe.includes("ERROR:") && projectDescribe.includes(SANDBOX_PROJECT);
  report(`sandbox project exists (${SANDBOX_PROJECT})`, projectExists, projectExists ? "provisioned" : "NOT_PROVISIONED — create via sandbox:bootstrap");

  // 4. Required Google APIs
  for (const api of REQUIRED_APIS) {
    let enabled = false;
    let detail = "";
    if (projectExists) {
      const services = run("gcloud", ["services", "list", "--project", SANDBOX_PROJECT, "--format=value(config.name)"], { failOk: true });
      enabled = services.includes(api);
      detail = enabled ? "enabled" : "disabled";
    } else {
      detail = "project missing";
    }
    report(`API ${api}`, enabled, detail);
  }

  // 5. Firebase Auth
  if (projectExists) {
    const authList = run("firebase", ["auth:list", "--project", SANDBOX_PROJECT], { failOk: true });
    const authOk = !/Error:|Cannot|not found|denied/i.test(authList);
    report("firebase auth available", authOk, authOk ? "responding" : authList.split("\n").slice(0, 1).join(" "));
  } else {
    report("firebase auth available", false, "project missing");
  }

  // 6. Hosting site
  if (projectExists) {
    const sites = run("firebase", ["hosting:sites:list", "--project", SANDBOX_PROJECT], { failOk: true });
    const siteOk = !/Error:|Cannot|not found|denied/i.test(sites);
    report("hosting site", siteOk, siteOk ? "responding" : sites.split("\n").slice(0, 1).join(" "));
  } else {
    report("hosting site", false, "project missing");
  }

  // 7. Required environment variables
  const dotenv = loadDotEnv();
  const requiredVars: Array<[string, string]> = [
    ["APP_ENV", "sandbox"],
    ["PADDLE_DISABLED", "true"],
    ["SYNTHETIC_DOSSIERS_ONLY", "true"],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", SANDBOX_PROJECT],
  ];
  for (const [name, expected] of requiredVars) {
    const actual = dotenv[name] ?? process.env[name] ?? "";
    const ok = actual === expected;
    report(`env ${name}=${expected}`, ok, ok ? "set" : `missing/mismatch (got "${actual || "unset"}")`);
  }

  // 8. Production project isolation
  const targetProject = dotenv["FIREBASE_PROJECT"] ?? process.env["FIREBASE_PROJECT"] ?? "";
  const isolationOk = targetProject !== PRODUCTION_PROJECT;
  report("production project isolation", isolationOk, isolationOk ? `seed target "${targetProject || "unset (emulator)"}" is not production` : "REFUSED: synthetic seeding must not target cbam-desk");

  // 9. Sandbox alias in .firebaserc
  const alias = hasFirebaseProjectAlias();
  report(".firebaserc sandbox alias", alias !== null, alias ? `maps to ${alias}` : "missing");

  console.log("");
  const failed = results.filter((item) => !item.pass);
  if (failed.length === 0) {
    console.log("SANDBOX_DOCTOR=ALL_PASS");
  } else {
    console.log(`SANDBOX_DOCTOR=FAIL (${failed.length} check${failed.length === 1 ? "" : "s"})`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

void main();
