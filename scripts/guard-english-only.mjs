import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let totalErrors = 0;

function logError(file, message) {
  console.error(`[GUARD-ENGLISH] [ERROR] ${file}: ${message}`);
  totalErrors++;
}

const forbiddenTurkishSubstrings = [
  "Tarih:",
  "Kredi",
  "HATA:",
  "GTİP",
  "Hukuki",
  "Feragatname",
  "Yükleniyor",
  "şebeke",
  "değeri",
  "girmelisiniz",
  "Karmaşık",
  "ürünler",
  "hammadde",
  "emisyon",
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
      if (path.extname(fullPath) === '.ts' || path.extname(fullPath) === '.tsx') {
        callback(fullPath);
      }
    }
  });
}

walk(rootDir, (filePath) => {
  const relPath = path.relative(rootDir, filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // Skip legacy / unused client files if we redirected them
  if (relPath.includes('dashboard/wizard/WizardClient.tsx') || relPath.includes('dashboard/DashboardClient.tsx')) {
    return;
  }

  for (const word of forbiddenTurkishSubstrings) {
    if (content.includes(word)) {
      logError(relPath, `Contains forbidden Turkish terminology: "${word}"`);
    }
  }
});

if (totalErrors > 0) {
  console.error(`[GUARD-ENGLISH] [FAIL] Found ${totalErrors} mixed-language / Turkish content violations.`);
  process.exit(1);
} else {
  console.log("[GUARD-ENGLISH] [SUCCESS] English-only content validation passed successfully.");
  process.exit(0);
}
