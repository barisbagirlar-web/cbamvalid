import fs from "fs";
import path from "path";

/**
 * Institutional Precision visual guard
 * Allowed palette: Oatmeal & Ink × Deep Forest × EU Seal Gold
 * Banned: AI-default purple/indigo/neon Tailwind utilities, Inter/Roboto class leakage,
 *         terracotta legacy hex, arbitrary off-palette hex in app/components.
 */

const BANNED_COLORS = [
  "emerald", "lime", "teal", "cyan", "blue", "indigo", "violet",
  "purple", "pink", "yellow", "amber", "orange", "slate", "zinc", "sky", "fuchsia", "rose",
  "green", "red",
];

const BANNED_CSS_CLASSES = ["bg-white", "text-black"];

const BANNED_HEX = [
  "#000000",
  // legacy terracotta / navy system
  "#bd5d3a", "#a94f31", "#93442a", "#c0562f", "#9c4523", "#f5e4d8",
  "#152238", "#0e1930", "#f0eee6", "#faf9f5", "#1a1915",
];

const ALLOWED_HEX = new Set([
  "#fafaf8", "#f0ede8", "#ffffff",
  "#1a1a1a", "#4a4a45", "#8a8a82",
  "#1b4332", "#2d6a4f", "#14532d", "#d8f3dc", "#a7c4b0",
  "#d4a017", "#e8c547",
  "#9b2226", "#f5e4e4", "#bb6b00", "#f8efd8",
  "#d8d1c7", "#a8a29e", "#e8e2d8",
  "#1c1917", "#e7e5e4",
]);

const BANNED_ICON_LIBS = ["heroicons", "font-awesome", "fontawesome", "material-icons", "@heroicons", "@fortawesome"];

const SVG_ALLOWLIST = [
  "components/brand/BrandMark.tsx",
  "components/layout/PublicHeader.tsx",
  "components/layout/AppFooter.tsx",
  "components/marketing/HeroDossierNarrative.tsx",
  "app/(public)/pricing/page.tsx",
  "app/(auth)/login/page.tsx",
  "app/(auth)/register/page.tsx",
];

const packageJsonPath = path.resolve("package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
if (!packageJson.dependencies["lucide-react"]) {
  console.error("❌ Visual System Guard Fail: lucide-react is not installed under dependencies.");
  process.exit(1);
}

let violations = 0;

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".firebase" && file !== ".git") {
        scanDirectory(fullPath);
      }
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      if ([".ts", ".tsx", ".css", ".js", ".mjs"].includes(ext)) {
        checkFile(fullPath);
      }
    }
  }
}

function isSvgAllowed(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  return SVG_ALLOWLIST.some((allowed) => normalized.endsWith(allowed));
}

function checkFile(filePath) {
  const ext = path.extname(filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  if (filePath.includes("guard-visual-system.mjs")) return;

  const isTokenFile =
    filePath.includes("globals.css") ||
    filePath.includes("tailwind.config.ts") ||
    filePath.includes("public/assets/css/style.css");

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const lowerLine = line.toLowerCase();

    if ((filePath.includes("login/page.tsx") || filePath.includes("register/page.tsx")) &&
        (lowerLine.includes("<svg") || lowerLine.includes("path d=") || lowerLine.includes("fill=\"#") || lowerLine.includes("</svg>"))) {
      return;
    }

    BANNED_COLORS.forEach((color) => {
      const colorRegex = new RegExp(`\\b(text|bg|border|accent|ring|from|to|via|fill|stroke)-${color}(-\\d{2,3}|\\/[\\d.]+)?\\b`, "i");
      if (colorRegex.test(line)) {
        console.error(`❌ Violation in ${filePath}:${lineNum}: Banned tailwind color "${color}" class found: "${line.trim()}"`);
        violations++;
      }
    });

    BANNED_CSS_CLASSES.forEach((cls) => {
      const classRegex = new RegExp(`\\b${cls}\\b`, "i");
      if (classRegex.test(line)) {
        console.error(`❌ Violation in ${filePath}:${lineNum}: Banned layout class "${cls}" found: "${line.trim()}"`);
        violations++;
      }
    });

    BANNED_HEX.forEach((hex) => {
      if (lowerLine.includes(hex)) {
        if (isTokenFile) return;
        console.error(`❌ Violation in ${filePath}:${lineNum}: Banned legacy hex color "${hex}" found: "${line.trim()}"`);
        violations++;
      }
    });

    const hexRegex = /#[0-9a-f]{3,8}\b/ig;
    let match;
    while ((match = hexRegex.exec(line)) !== null) {
      const hexVal = match[0].toLowerCase();
      if (hexVal === "#fff" || hexVal === "#000") {
        if (!isTokenFile) {
          console.error(`❌ Violation in ${filePath}:${lineNum}: Banned shorthand hex "${hexVal}" found: "${line.trim()}"`);
          violations++;
        }
        continue;
      }
      if (!ALLOWED_HEX.has(hexVal)) {
        if (isTokenFile || filePath.includes("next.config")) continue;
        console.error(`❌ Violation in ${filePath}:${lineNum}: Unapproved custom hex code "${hexVal}" found: "${line.trim()}"`);
        violations++;
      }
    }

    BANNED_ICON_LIBS.forEach((lib) => {
      if (lowerLine.includes(`from "${lib}"`) || lowerLine.includes(`from '${lib}'`)) {
        console.error(`❌ Violation in ${filePath}:${lineNum}: Banned icon library "${lib}" import found: "${line.trim()}"`);
        violations++;
      }
    });

    if (
      ext === ".tsx" &&
      line.includes("<svg") &&
      !line.includes("lucide") &&
      !isSvgAllowed(filePath) &&
      !/stroke=["']currentColor["']/.test(line) &&
      !/fill=["']currentColor["']/.test(line)
    ) {
      console.error(`❌ Violation in ${filePath}:${lineNum}: Inline SVG markup found in code file: "${line.trim()}"`);
      violations++;
    }

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(line) && !filePath.includes("node_modules")) {
      console.error(`❌ Violation in ${filePath}:${lineNum}: Emoji character found: "${line.trim()}"`);
      violations++;
    }
  });
}

scanDirectory("app");
scanDirectory("components");
scanDirectory("lib");
scanDirectory("styles");

if (violations > 0) {
  console.error(`\n❌ Visual System Guard failed with ${violations} violations.`);
  process.exit(1);
} else {
  console.log("✅ Visual System Guard: PASS. Institutional Precision palette enforced.");
  process.exit(0);
}
