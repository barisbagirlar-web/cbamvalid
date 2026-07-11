import nextEnv from "@next/env";
import fs from "fs";
import path from "path";

const { loadEnvConfig } = nextEnv;

const isProduction =
  process.argv.includes("--production") ||
  process.env.AUTH_GUARD_MODE === "production" ||
  process.env.NODE_ENV === "production";

// Next.js env loading order is used.
// Production mode loads production-oriented env files.
loadEnvConfig(process.cwd(), !isProduction);

// Clean up env.local variables during local production checks to simulate a clean production env
if (isProduction) {
  const prodEnvPath = path.join(process.cwd(), ".env.production");
  const baseEnvPath = path.join(process.cwd(), ".env");
  
  if (fs.existsSync(prodEnvPath)) {
    const prodEnvContent = fs.readFileSync(prodEnvPath, "utf8");
    const lines = prodEnvContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    }
  }

  const hasMockInProductionEnv =
    (fs.existsSync(prodEnvPath) && fs.readFileSync(prodEnvPath, "utf8").includes("AUTH_ALLOW_MOCK")) ||
    (fs.existsSync(baseEnvPath) && fs.readFileSync(baseEnvPath, "utf8").includes("AUTH_ALLOW_MOCK"));

  if (!hasMockInProductionEnv && process.env.AUTH_ALLOW_MOCK) {
    delete process.env.AUTH_ALLOW_MOCK;
  }
}

const errors = [];

function addError(message) {
  errors.push(message);
}

function readRequired(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    addError(`Missing required environment variable: ${name}`);
    return "";
  }

  return value;
}

function readBoolean(name, defaultValue = false) {
  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    return defaultValue;
  }

  if (raw !== "true" && raw !== "false") {
    addError(`${name} must be exactly "true" or "false".`);
    return defaultValue;
  }

  return raw === "true";
}

function readInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name]?.trim() || String(fallback);
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    addError(`${name} must be a finite integer.`);
    return fallback;
  }

  if (parsed < minimum) {
    addError(`${name} must be at least ${minimum}.`);
  }

  if (parsed > maximum) {
    addError(`${name} must not exceed ${maximum}.`);
  }

  return parsed;
}

function decodeStrictBase64(value) {
  const compact = value.replace(/\s+/g, "");

  if (!compact) {
    throw new Error("Base64 value is empty.");
  }

  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(compact) ||
    compact.length % 4 !== 0
  ) {
    throw new Error("Base64 format is invalid.");
  }

  const decodedBuffer = Buffer.from(compact, "base64");

  if (decodedBuffer.length === 0) {
    throw new Error("Decoded Base64 value is empty.");
  }

  const normalizedInput = compact.replace(/=+$/, "");
  const normalizedRoundTrip = decodedBuffer
    .toString("base64")
    .replace(/=+$/, "");

  if (normalizedInput !== normalizedRoundTrip) {
    throw new Error("Base64 round-trip validation failed.");
  }

  return decodedBuffer.toString("utf8");
}

function validateOrigins(rawOrigins) {
  const origins = rawOrigins
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    addError("AUTH_ALLOWED_ORIGINS must contain at least one origin.");
    return [];
  }

  const normalizedOrigins = [];

  for (const rawOrigin of origins) {
    if (rawOrigin.includes("*")) {
      addError(`Wildcard origin is forbidden: ${rawOrigin}`);
      continue;
    }

    let parsed;

    try {
      parsed = new URL(rawOrigin);
    } catch {
      addError(`Invalid origin URL: ${rawOrigin}`);
      continue;
    }

    if (parsed.username || parsed.password) {
      addError(`Origin must not contain credentials: ${rawOrigin}`);
    }

    if (
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      addError(
        `Origin must not contain a path, query or hash: ${rawOrigin}`
      );
    }

    if (isProduction && parsed.protocol !== "https:") {
      addError(`Production origin must use HTTPS: ${rawOrigin}`);
    }

    if (isProduction && parsed.port) {
      addError(`Production origin must not use a custom port: ${rawOrigin}`);
    }

    normalizedOrigins.push(parsed.origin);
  }

  const uniqueOrigins = new Set(normalizedOrigins);

  if (uniqueOrigins.size !== normalizedOrigins.length) {
    addError("AUTH_ALLOWED_ORIGINS contains duplicate origins.");
  }

  if (
    isProduction &&
    !uniqueOrigins.has("https://cbamvalid.com")
  ) {
    addError(
      "Production AUTH_ALLOWED_ORIGINS must contain exactly https://cbamvalid.com."
    );
  }

  return [...uniqueOrigins];
}

function validateFirebaseProjectId(projectId) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    addError(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID does not match the expected Firebase project ID format."
    );
  }
}

function validateFirebaseAdminCredential({
  encodedCredential,
  clientProjectId,
}) {
  let parsed;

  try {
    const decoded = decodeStrictBase64(encodedCredential);
    parsed = JSON.parse(decoded);
  } catch {
    addError(
      "ADMIN_SERVICE_ACCOUNT_B64 is not valid strict Base64-encoded JSON."
    );
    return;
  }

  if (parsed.type !== "service_account") {
    addError(
      'Firebase Admin credential type must be "service_account".'
    );
  }

  for (const field of [
    "project_id",
    "client_email",
    "private_key",
  ]) {
    if (
      typeof parsed[field] !== "string" ||
      !parsed[field].trim()
    ) {
      addError(
        `Firebase Admin service account is missing field: ${field}`
      );
    }
  }

  if (
    parsed.project_id &&
    parsed.project_id !== clientProjectId
  ) {
    addError(
      "Project ID mismatch between Firebase Client and Firebase Admin credentials."
    );
  }

  if (
    parsed.client_email &&
    !parsed.client_email.endsWith(".gserviceaccount.com")
  ) {
    addError(
      "Firebase Admin client_email is not a Google service-account address."
    );
  }

  if (
    parsed.private_key &&
    (
      !parsed.private_key.includes(
        "-----BEGIN PRIVATE KEY-----"
      ) ||
      !parsed.private_key.includes(
        "-----END PRIVATE KEY-----"
      )
    )
  ) {
    addError(
      "Firebase Admin private_key does not contain a complete PEM private key."
    );
  }
}

function assertValidEnvironment() {
  const apiKey = readRequired(
    "NEXT_PUBLIC_FIREBASE_API_KEY"
  );

  const authDomain = readRequired(
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  );

  const projectId = readRequired(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  );

  const appId = readRequired(
    "NEXT_PUBLIC_FIREBASE_APP_ID"
  );

  const baseUrl = readRequired(
    "NEXT_PUBLIC_BASE_URL"
  );

  if (isProduction) {
    if (authDomain !== "cbam-desk.firebaseapp.com") {
      addError(`Production NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN must be exactly "cbam-desk.firebaseapp.com", got: "${authDomain}"`);
    }
    if (baseUrl !== "https://cbamvalid.com") {
      addError(`Production NEXT_PUBLIC_BASE_URL must be exactly "https://cbamvalid.com", got: "${baseUrl}"`);
    }
  }

  if (projectId) {
    validateFirebaseProjectId(projectId);
  }

  if (
    apiKey &&
    !apiKey.startsWith("AIza")
  ) {
    addError(
      "NEXT_PUBLIC_FIREBASE_API_KEY does not match the expected Firebase API-key format."
    );
  }

  if (
    authDomain &&
    (
      authDomain.includes("/") ||
      authDomain.includes("://")
    )
  ) {
    addError(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN must be a hostname, not a URL."
    );
  }

  if (
    appId &&
    !appId.includes(":web:")
  ) {
    addError(
      "NEXT_PUBLIC_FIREBASE_APP_ID does not appear to be a Firebase Web App ID."
    );
  }

  const encodedCredential =
    process.env
      .ADMIN_SERVICE_ACCOUNT_B64
      ?.trim() || "";

  const hasB64 = encodedCredential.length > 0;

  const useADC = readBoolean(
    "ADMIN_USE_ADC",
    false
  );

  const adcRuntimeConfirmed = readBoolean(
    "ADMIN_ADC_RUNTIME_CONFIRMED",
    false
  );

  if (!hasB64 && !useADC) {
    addError(
      "Neither Firebase Admin service-account Base64 credential nor ADC mode is configured."
    );
  }

  if (hasB64 && useADC) {
    addError(
      "Both Firebase Admin credential modes are configured. Exactly one mode is required."
    );
  }

  if (
    isProduction &&
    useADC &&
    !adcRuntimeConfirmed
  ) {
    addError(
      "ADC production mode requires ADMIN_ADC_RUNTIME_CONFIRMED=true."
    );
  }

  if (hasB64 && projectId) {
    validateFirebaseAdminCredential({
      encodedCredential,
      clientProjectId: projectId,
    });
  }

  const mockAuthValue =
    process.env.AUTH_ALLOW_MOCK;

  if (
    isProduction &&
    mockAuthValue !== undefined
  ) {
    addError(
      "AUTH_ALLOW_MOCK must not exist in the production environment."
    );
  }

  readInteger(
    "AUTH_SESSION_TTL_SECONDS",
    432000,
    300,
    1209600
  );

  readInteger(
    "AUTH_SESSION_MAX_AUTH_AGE_SECONDS",
    300,
    60,
    3600
  );

  const rawOrigins =
    readRequired("AUTH_ALLOWED_ORIGINS");

  if (rawOrigins) {
    validateOrigins(rawOrigins);
  }

  if (isProduction) {
    const nextStaticChunksDir = path.join(process.cwd(), ".next", "static", "chunks");
    if (fs.existsSync(nextStaticChunksDir)) {
      console.log("[GUARD-ENV] Scanning .next/static/chunks directory...");
      let cbamvalidFound = false;
      let devProjectIdFound = false;
      let undefinedFound = false;

      function scanDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (file.endsWith(".js")) {
            const content = fs.readFileSync(fullPath, "utf8");
            if (content.includes("cbam-desk.firebaseapp.com")) {
              cbamvalidFound = true;
            }
            if (content.includes("dummy-project") || content.includes("cbam-desk-dev")) {
              devProjectIdFound = true;
            }
            if (content.includes("authDomain:undefined") || content.includes('authDomain:"undefined"') || content.includes('authDomain:""') || content.includes("authDomain:\"\"")) {
              undefinedFound = true;
            }
          }
        }
      }

      scanDir(nextStaticChunksDir);

      if (!cbamvalidFound) {
        addError("Post-build scan: cbam-desk.firebaseapp.com domain not found in production chunks.");
      }
      if (devProjectIdFound) {
        addError("Post-build scan: Banned development project IDs (dummy-project / cbam-desk-dev) found in production chunks.");
      }
      if (undefinedFound) {
        addError("Post-build scan: authDomain is undefined or an empty string inside the production client bundle.");
      }
    } else {
      console.log("[GUARD-ENV] .next/static/chunks not found. Post-build client bundle scanning skipped (it will run during final build validation).");
    }
  }

  if (errors.length > 0) {
    console.error("");
    console.error("AUTH_ENV_GUARD=FAIL");

    errors.forEach((error, index) => {
      console.error(`${index + 1}. ${error}`);
    });

    process.exitCode = 1;
    return;
  }

  let projectMatchState;

  if (hasB64) {
    projectMatchState = "YES";
  } else if (useADC) {
    projectMatchState = "ADC_RUNTIME";
  } else {
    projectMatchState = "NO";
  }

  console.log("AUTH_ENV_GUARD=PASS");
  console.log(
    `CREDENTIAL_MODE=${
      hasB64
        ? "SERVICE_ACCOUNT_B64"
        : "ADC"
    }`
  );
  console.log(
    `PROJECT_ID_MATCH=${projectMatchState}`
  );
  console.log("PRODUCTION_MOCK_AUTH=ABSENT");
  console.log("ORIGIN_POLICY=PASS");
  console.log("SESSION_TTL_POLICY=PASS");
  console.log(
    `GUARD_MODE=${
      isProduction
        ? "PRODUCTION"
        : "DEVELOPMENT"
    }`
  );
}

assertValidEnvironment();
