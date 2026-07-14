import fs from "fs";
import path from "path";
import { PUBLIC_NAV, APP_NAV } from "../lib/navigation";

function routeExists(href: string): boolean {
  if (href.startsWith("#") || href === "") return false;
  const cleanPath = href.split("?")[0];
  if (cleanPath === "/") {
    return fs.existsSync(path.join(process.cwd(), "app/(public)/page.tsx")) ||
           fs.existsSync(path.join(process.cwd(), "app/page.tsx"));
  }

  const targetDir = cleanPath.substring(1);
  const possiblePaths = [
    path.join(process.cwd(), "app", targetDir, "page.tsx"),
    path.join(process.cwd(), "app/(public)", targetDir, "page.tsx"),
    path.join(process.cwd(), "app/(workspace)", targetDir, "page.tsx"),
    path.join(process.cwd(), "app/(auth)", targetDir, "page.tsx"),
  ];

  return possiblePaths.some(p => fs.existsSync(p));
}

let publicPassed = 0;
let appPassed = 0;
let footerPassed = 0;

PUBLIC_NAV.forEach(link => {
  if (routeExists(link.href)) {
    publicPassed++;
  } else {
    console.error(`Missing public route: ${link.label} (${link.href})`);
  }
});

APP_NAV.forEach(link => {
  if (routeExists(link.href)) {
    appPassed++;
  } else {
    console.error(`Missing app route: ${link.label} (${link.href})`);
  }
});

const additionalFooterLinks = [
  "/contact", "/terms", "/privacy", "/refund-policy", "/cookie-policy", "/legal-notice", "/about"
];
additionalFooterLinks.forEach(href => {
  if (routeExists(href)) {
    footerPassed++;
  } else {
    console.error(`Missing footer route: ${href}`);
  }
});

const footerTotal = PUBLIC_NAV.length + additionalFooterLinks.length;
const totalFooterPassed = publicPassed + footerPassed;

console.log(`PUBLIC_NAV_ROUTES=${publicPassed}/${PUBLIC_NAV.length}`);
console.log(`APP_NAV_ROUTES=${appPassed}/${APP_NAV.length}`);
console.log(`FOOTER_ROUTES=${totalFooterPassed}/${footerTotal}`);

const missingRoutes = (PUBLIC_NAV.length - publicPassed) + 
                      (APP_NAV.length - appPassed) + 
                      (additionalFooterLinks.length - footerPassed);

console.log(`MISSING_ROUTES=${missingRoutes}`);

if (missingRoutes > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
