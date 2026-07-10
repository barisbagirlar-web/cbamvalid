import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let totalErrors = 0;

function logError(file, message) {
  console.error(`[GUARD-COMMERCE] [ERROR] ${file}: ${message}`);
  totalErrors++;
}

// Check for duplicate webhook routes
const webhookPath1 = path.join(rootDir, 'app/api/webhook/paddle');
const webhookPath2 = path.join(rootDir, 'app/api/webhooks/paddle');

if (fs.existsSync(webhookPath1) && fs.existsSync(webhookPath2)) {
  logError("app/api", "More than one Paddle webhook route exists.");
}

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

  // Skip guard scripts themselves
  if (relPath.startsWith('scripts/')) return;

  // 1. Check for client-provided price ID or amount submission in client/API checkout
  if (relPath.includes('checkout') && relPath.includes('route.ts')) {
    if (content.includes('body.priceId') || content.includes('body.amount') || content.includes('body.currency')) {
      logError(relPath, "Accepts client-provided price ID, amount or currency in checkout creation.");
    }
  }

  // 2. Check for legacy tokens writes in main commerce logic
  if (relPath.includes('webhooks/paddle') && relPath.includes('route.ts')) {
    if (content.includes('users.tokens') || content.includes('tokensPurchased')) {
      logError(relPath, "Legacy direct tokens/credits grant rules found in webhook route.");
    }
  }
  
  if (relPath.includes('cbam/generate') && relPath.includes('route.ts')) {
    if (content.includes('users.tokens') || content.includes('tokens:')) {
      logError(relPath, "Legacy direct tokens/credits consumption rules found in generate route.");
    }
  }

  // 3. Ensure Firestore transaction is used on entitlement changes
  if (content.includes('consumeEntitlement') || content.includes('reserveEntitlement')) {
    if (!content.includes('runTransaction') && !content.includes('dbTransaction')) {
      logError(relPath, "Missing Firestore transaction context on entitlement mutation.");
    }
  }
});

if (totalErrors > 0) {
  console.error(`[GUARD-COMMERCE] [FAIL] Found ${totalErrors} architectural verification errors.`);
  process.exit(1);
} else {
  console.log("[GUARD-COMMERCE] [SUCCESS] Commercial architectural validation passed successfully.");
  process.exit(0);
}
