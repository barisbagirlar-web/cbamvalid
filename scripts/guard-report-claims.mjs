import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let totalErrors = 0;

function logError(file, message) {
  console.error(`[GUARD-CLAIMS] [ERROR] ${file}: ${message}`);
  totalErrors++;
}

const forbiddenClaims = [
  "CBAM certified",
  "EU certified",
  "officially approved",
  "guaranteed compliant",
  "verified emissions",
  "accredited report",
  "accepted by all authorities",
];

// Scan files
function walk(dir, callback) {
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (
        file !== 'node_modules' &&
        file !== '.next' &&
        file !== '.git' &&
        file !== '.firebase' &&
        file !== 'scripts' &&
        file !== 'tests'
      ) {
        walk(fullPath, callback);
      }
    } else {
      if (path.extname(fullPath) === '.ts' || path.extname(fullPath) === '.tsx' || path.extname(fullPath) === '.js') {
        callback(fullPath);
      }
    }
  });
}

walk(rootDir, (filePath) => {
  const relPath = path.relative(rootDir, filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // Skip guard scripts themselves
  if (relPath.startsWith('scripts/')) return;

  for (const claim of forbiddenClaims) {
    if (content.toLowerCase().includes(claim.toLowerCase())) {
      logError(relPath, `Contains forbidden claim: "${claim}"`);
    }
  }
});

if (totalErrors > 0) {
  console.error(`[GUARD-CLAIMS] [FAIL] Found ${totalErrors} claims compliance errors.`);
  process.exit(1);
} else {
  console.log("[GUARD-CLAIMS] [SUCCESS] Claims validation passed successfully.");
  process.exit(0);
}
