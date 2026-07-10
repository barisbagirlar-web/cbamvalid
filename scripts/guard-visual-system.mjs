import fs from "fs";
import path from "path";

const BANNED_COLORS = [
  "green", "emerald", "lime", "teal", "cyan", "blue", "indigo", "violet",
  "purple", "pink", "yellow", "amber"
];

const BANNED_CSS_CLASSES = ["bg-white", "text-black"];
const BANNED_HEX = ["#000000", "#ffffff"];
const BANNED_ICON_LIBS = ["heroicons", "font-awesome", "fontawesome", "material-icons", "@heroicons", "@fortawesome"];

const ALLOWED_HEX = [
  "#f0eee6", "#faf9f5", "#1a1915", "#bd5d3a", "#a94f31", "#93442a"
];

// Check package.json for lucide-react
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

function checkFile(filePath) {
  const ext = path.extname(filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  // Skip visual guard script itself
  if (filePath.includes("guard-visual-system.mjs")) return;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const lowerLine = line.toLowerCase();

    // Ignore official Google logo SVG lines inside login and registration pages
    if ((filePath.includes("login/page.tsx") || filePath.includes("register/page.tsx")) && 
        (lowerLine.includes("<svg") || lowerLine.includes("path d=") || lowerLine.includes("fill=\"#") || lowerLine.includes("</svg>"))) {
      return;
    }

    // 1. Check for banned colors (checking classes/attributes)
    BANNED_COLORS.forEach(color => {
      // Look for tailwind classes like text-color, bg-color, border-color, accent-color
      const colorRegex = new RegExp(`\\b(text|bg|border|accent|ring|from|to|via)-${color}\\b`, "i");
      if (colorRegex.test(line)) {
        console.error(`❌ Violation in ${filePath}:${lineNum}: Banned tailwind color "${color}" class found: "${line.trim()}"`);
        violations++;
      }
    });

    // 2. Check for banned raw css classes
    BANNED_CSS_CLASSES.forEach(cls => {
      const classRegex = new RegExp(`\\b${cls}\\b`, "i");
      if (classRegex.test(line)) {
        console.error(`❌ Violation in ${filePath}:${lineNum}: Banned layout class "${cls}" found: "${line.trim()}"`);
        violations++;
      }
    });

    // 3. Check for banned hex colors
    BANNED_HEX.forEach(hex => {
      if (lowerLine.includes(hex)) {
        // Allow in globals.css/tailwind.config.ts if it's not setting foreground/background
        if (filePath.includes("globals.css") || filePath.includes("tailwind.config.ts")) {
          // Allowed for config mappings or generic overrides if needed, but fail on direct page usage
          return;
        }
        console.error(`❌ Violation in ${filePath}:${lineNum}: Banned raw hex color "${hex}" found: "${line.trim()}"`);
        violations++;
      }
    });

    // 4. Check for unauthorized hex codes (any hex code that is not allowed)
    const hexRegex = /#[0-9a-f]{3,8}\b/ig;
    let match;
    while ((match = hexRegex.exec(line)) !== null) {
      const hexVal = match[0].toLowerCase();
      // Allow allowed hexes, ignore standard css placeholders or length-based non-colors
      if (!ALLOWED_HEX.includes(hexVal) && hexVal !== "#fff" && hexVal !== "#000") {
        if (filePath.includes("globals.css") || filePath.includes("tailwind.config.ts") || filePath.includes("next.config.ts")) {
          continue;
        }
        console.error(`❌ Violation in ${filePath}:${lineNum}: Unapproved custom hex code "${hexVal}" found: "${line.trim()}"`);
        violations++;
      }
    }

    // 5. Check for banned icon libraries
    BANNED_ICON_LIBS.forEach(lib => {
      if (lowerLine.includes(`from "${lib}"`) || lowerLine.includes(`from '${lib}'`)) {
        console.error(`❌ Violation in ${filePath}:${lineNum}: Banned icon library "${lib}" import found: "${line.trim()}"`);
        violations++;
      }
    });

    // 6. Check for inline SVG tags in non-asset code files (excluding public static files)
    if (ext === ".tsx" && line.includes("<svg") && !filePath.includes("cbam_logo.svg") && !line.includes("lucide")) {
      console.error(`❌ Violation in ${filePath}:${lineNum}: Inline SVG markup found in code file: "${line.trim()}"`);
      violations++;
    }

    // 7. Check for emoji usage in UI
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    if (emojiRegex.test(line) && !filePath.includes("guard-visual-system.mjs") && !filePath.includes("node_modules")) {
      console.error(`❌ Violation in ${filePath}:${lineNum}: Emoji character found: "${line.trim()}"`);
      violations++;
    }
  });
}

// Start scan
scanDirectory("app");
scanDirectory("components");
scanDirectory("lib");
scanDirectory("styles");

if (violations > 0) {
  console.error(`\n❌ Visual System Guard failed with ${violations} violations.`);
  process.exit(1);
} else {
  console.log("✅ Visual System Guard: PASS. All files conform to the Approved Palette and rules.");
  process.exit(0);
}
