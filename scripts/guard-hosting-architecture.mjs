import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const rootDir = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

const appHostingConfigPath = path.join(rootDir, "apphosting.yaml");
if (!fs.existsSync(appHostingConfigPath)) {
  fail("apphosting.yaml is required; CBAMValid uses Firebase App Hosting");
} else {
  try {
    const raw = fs.readFileSync(appHostingConfigPath, "utf8");
    const config = yaml.parse(raw);

    if (Object.hasOwn(config ?? {}, "run")) {
      fail('apphosting.yaml must use "runConfig", not "run" (schema typo - silently ignored by App Hosting)');
    }

    if (!config?.runConfig || typeof config.runConfig !== "object") {
      fail("apphosting.yaml must define a runConfig block (cpu/memoryMiB/minInstances/concurrency)");
    }
  } catch {
    fail("apphosting.yaml must contain valid YAML");
  }
}

const firebaseConfigPath = path.join(rootDir, "firebase.json");
if (!fs.existsSync(firebaseConfigPath)) {
  fail("firebase.json is required (firestore/storage rules)");
} else {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));

    if (Object.hasOwn(firebaseConfig, "hosting")) {
      fail("firebase.json must not define a hosting block; App Hosting owns hosting, not classic Firebase Hosting");
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
console.log("HOSTING_PROVIDER=FIREBASE_APP_HOSTING");
console.log("TRACKED_SECRET_SCAN=PASS");
