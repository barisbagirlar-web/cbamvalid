import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

function rejectText(source, rejected, label) {
  if (source.includes(rejected)) {
    failures.push(`${label}: prohibited ${JSON.stringify(rejected)}`);
  }
}

const navigation = read("lib/navigation.ts");
const publicLayout = read("app/(public)/layout.tsx");
const workspaceLayout = read("app/(workspace)/layout.tsx");
const dashboard = read("app/(workspace)/cbam/page.tsx");
const cases = read("app/(workspace)/cases/page.tsx");
const reports = read("app/(workspace)/reports/page.tsx");
const workspaceMethodology = read("app/(workspace)/cbam/methodology/page.tsx");
const publicMethodology = read("app/(public)/methodology/page.tsx");

const routeContracts = [
  ['{ label: "Dashboard", href: "/cbam" }', "Dashboard route"],
  ['{ label: "Cases", href: "/cases" }', "Cases route"],
  ['{ label: "Reports", href: "/reports" }', "Reports route"],
  ['{ label: "Methodology & Sources", href: "/cbam/methodology" }', "Workspace methodology route"]
];

for (const [contract, label] of routeContracts) {
  requireText(navigation, contract, label);
}

requireText(publicLayout, "<PublicHeader />", "Public layout header");
rejectText(publicLayout, "<AppHeader />", "Public layout header isolation");
requireText(workspaceLayout, "<AppHeader />", "Workspace layout header");
rejectText(workspaceLayout, "<PublicHeader />", "Workspace layout header isolation");

requireText(dashboard, "Prepare Your CBAM Verification Package", "New-user onboarding");
requireText(cases, "Cases", "Cases page content");
requireText(reports, "Reports", "Reports page content");
requireText(workspaceMethodology, "MethodologyContent", "Workspace methodology content");
requireText(publicMethodology, "MethodologyContent", "Public methodology content");

rejectText(cases, 'router.replace("/cbam")', "Cases must not redirect to Dashboard");
rejectText(reports, 'router.replace("/cbam")', "Reports must not redirect to Dashboard");

const appNavBlock = navigation.match(/export const APP_NAV = \[(.*?)\] as const;/s)?.[1] ?? "";
const hrefs = [...appNavBlock.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);
if (hrefs.length !== new Set(hrefs).size) {
  failures.push(`APP_NAV routes must be unique. Found: ${hrefs.join(", ")}`);
}

if (failures.length > 0) {
  console.error("WORKSPACE_NAVIGATION_GUARD=FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("WORKSPACE_NAVIGATION_GUARD=PASS");
console.log(`APP_NAV_ROUTES=${hrefs.join(",")}`);
console.log("HEADER_LAYOUT_ISOLATION=PASS");
console.log("NEW_USER_ONBOARDING_CONTRACT=PASS");
