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
const legacyDashboard = read("app/(workspace)/dashboard/page.tsx");
const cases = read("app/(workspace)/cases/page.tsx");
const reports = read("app/(workspace)/reports/page.tsx");
const workspaceMethodology = read("app/(workspace)/cbam/methodology/page.tsx");
const publicMethodology = read("app/(public)/methodology/page.tsx");

const routeContracts = [
  ['{ label: "Dashboard", href: "/cbam" }', "Dashboard route"],
  ['{ label: "Cases", href: "/cases" }', "Cases route"],
  ['{ label: "Reports", href: "/reports" }', "Reports route"],
  ['{ label: "Methodology & Sources", href: "/cbam/methodology" }', "Workspace methodology route"],
];

for (const [contract, label] of routeContracts) {
  requireText(navigation, contract, label);
}

requireText(publicLayout, "<PublicHeader />", "Public layout header");
rejectText(publicLayout, "<AppHeader />", "Public layout header isolation");
requireText(workspaceLayout, "<AppHeader />", "Workspace layout header");
rejectText(workspaceLayout, "<PublicHeader />", "Workspace layout header isolation");

requireText(dashboard, "Prepare Your CBAM Verification Package", "New-user onboarding");
requireText(dashboard, "Recent Cases", "Dashboard recent-case summary");
requireText(dashboard, "Recent Reports", "Dashboard recent-report summary");
requireText(dashboard, "View All Cases", "Dashboard cases handoff");
requireText(dashboard, "View All Reports", "Dashboard reports handoff");
requireText(dashboard, ".slice(0, RECENT_ITEM_LIMIT)", "Dashboard recent-item limit");
rejectText(dashboard, "cases.map((", "Dashboard must not render the complete cases collection");
rejectText(dashboard, "reports.map((", "Dashboard must not render the complete reports collection");

requireText(cases, "My CBAM Cases", "Cases page identity");
requireText(cases, "cases.map((", "Cases page owns the complete case list");
requireText(reports, "Sealed Reports History", "Reports page identity");
requireText(reports, "reports.map((", "Reports page owns the complete report list");
requireText(workspaceMethodology, "MethodologyContent", "Workspace methodology content");
requireText(publicMethodology, "MethodologyContent", "Public methodology content");

requireText(legacyDashboard, 'redirect("/cbam")', "Legacy dashboard canonical redirect");
rejectText(legacyDashboard, "useRouter", "Legacy dashboard must not use a client redirect");
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
console.log("DASHBOARD_CASES_REPORTS_SEPARATION=PASS");
console.log("LEGACY_DASHBOARD_REDIRECT=PASS");
console.log("NEW_USER_ONBOARDING_CONTRACT=PASS");
