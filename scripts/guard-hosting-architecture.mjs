import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

const appHostingConfigPath = path.join(rootDir, "apphosting.yaml");
if (fs.existsSync(appHostingConfigPath)) {
  fail("apphosting.yaml is prohibited; CBAMValid uses Firebase Framework-Aware Hosting");
}

const firebaseConfigPath = path.join(rootDir, "firebase.json");
if (!fs.existsSync(firebaseConfigPath)) {
  fail("firebase.json is required for Firebase Framework-Aware Hosting");
} else {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    const hosting = firebaseConfig.hosting;

    if (!hosting || typeof hosting !== "object" || Array.isArray(hosting)) {
      fail("firebase.json must define a hosting object");
    } else {
      if (hosting.source !== ".") {
        fail('firebase.json hosting.source must be "."');
      }

      const backend = hosting.frameworksBackend;
      if (!backend || typeof backend !== "object" || Array.isArray(backend)) {
        fail("firebase.json must define hosting.frameworksBackend");
      } else if (backend.region !== "europe-west1") {
        fail('firebase.json hosting.frameworksBackend.region must be "europe-west1"');
      }
    }

    if (Object.hasOwn(firebaseConfig, "apphosting")) {
      fail("firebase.json must not define Firebase App Hosting configuration");
    }
  } catch {
    fail("firebase.json must contain valid JSON");
  }
}

const trackedFilesResult = spawnSync("git", ["ls-files", "-z"], {
  cwd: rootDir,
  encoding: "buffer",
  maxBuffer: 32 * 1024 * 1024,
});

if (trackedFilesResult.status !== 0 || !trackedFilesResult.stdout) {
  fail("unable to enumerate tracked files for the secret scan");
} else {
  const trackedFiles = trackedFilesResult.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter(
      (relativePath) =>
        relativePath !== "scripts/guard-hosting-architecture.mjs" &&
        relativePath !== "scripts/guard-auth-env.mjs",
    );

  const secretPatterns = [
    {
      label: "Paddle server API key",
      pattern: /\bpdl_(?:live|sdbx)_apikey_[A-Za-z0-9_-]{16,}\b/,
    },
    {
      label: "Paddle webhook secret",
      pattern: /\bpws_(?:live|sandbox)_[A-Za-z0-9_-]{16,}\b/,
    },
    {
      label: "private key material",
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    },
  ];

  for (const relativePath of trackedFiles) {
    const absolutePath = path.join(rootDir, relativePath);
    let stat;

    try {
      stat = fs.statSync(absolutePath);
    } catch {
      continue;
    }

    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) {
      continue;
    }

    const content = fs.readFileSync(absolutePath);
    if (content.includes(0)) {
      continue;
    }

    const text = content.toString("utf8");
    for (const { label, pattern } of secretPatterns) {
      if (pattern.test(text)) {
        fail(`${relativePath} contains prohibited ${label}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("HOSTING_ARCHITECTURE_GUARD=FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("HOSTING_ARCHITECTURE_GUARD=PASS");
console.log("HOSTING_PROVIDER=FIREBASE_FRAMEWORK_AWARE_HOSTING");
console.log("HOSTING_REGION=europe-west1");
console.log("TRACKED_SECRET_SCAN=PASS");
