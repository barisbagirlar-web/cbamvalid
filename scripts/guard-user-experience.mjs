import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const appRoot = path.join(root, "app");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function routeFromPage(file) {
  const relative = path.relative(appRoot, file).replaceAll(path.sep, "/");
  const segments = relative
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter((segment) => segment && !/^\(.+\)$/.test(segment));
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

const contractUrl = pathToFileURL(path.join(root, "lib/product/route-experience-contract.ts")).href;
const { getRouteExperience } = await import(contractUrl);
const pages = walk(appRoot).filter((file) => file.endsWith(`${path.sep}page.tsx`));
const failures = [];

for (const page of pages) {
  const route = routeFromPage(page);
  const contract = getRouteExperience(route);
  for (const field of ["audience", "primaryTask", "primaryAction", "successOutcome"]) {
    if (!String(contract?.[field] || "").trim()) {
      failures.push(`${route}: missing ${field}`);
    }
  }
}

const customerRoots = [
  path.join(root, "app/(public)"),
  path.join(root, "app/(workspace)/cbam"),
  path.join(root, "app/(workspace)/cases"),
  path.join(root, "app/(workspace)/credits"),
  path.join(root, "app/(workspace)/reports"),
  path.join(root, "app/(workspace)/account"),
  path.join(root, "components/layout"),
  path.join(root, "lib/seo"),
];
const customerFiles = customerRoots
  .filter((directory) => fs.existsSync(directory))
  .flatMap((directory) => walk(directory))
  .filter((file) => /\.(?:ts|tsx)$/.test(file));

const bannedCopy = [
  [/\$149\b/i, "obsolete $149 price"],
  [/\b100 credits\b/i, "legacy credit quantity"],
  [/\b(?:five|5) sealed releases\b/i, "legacy release allowance"],
  [/\b(?:up to )?(?:five|5) locked packages\b/i, "legacy locked-package allowance"],
  [/\breleases left\b/i, "internal release meter"],
  [/\bfictional installation\b/i, "fabricated report fallback"],
];

for (const file of customerFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const [pattern, label] of bannedCopy) {
    if (pattern.test(source)) {
      failures.push(`${path.relative(root, file)}: ${label}`);
    }
  }
  if (/href=\{?["'`]\/credits\/buy["'`]\}?/.test(source)) {
    failures.push(`${path.relative(root, file)}: unscoped checkout link`);
  }
}

const buyClient = fs.readFileSync(
  path.join(root, "app/(workspace)/credits/buy/BuyCreditsPageClient.tsx"),
  "utf8"
);
if (!buyClient.includes("?step=8&purchase=success")) {
  failures.push("checkout success does not return to working-file step 8");
}

if (failures.length > 0) {
  console.error("USER_EXPERIENCE_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`USER_EXPERIENCE_GUARD=PASS routes=${pages.length}`);
