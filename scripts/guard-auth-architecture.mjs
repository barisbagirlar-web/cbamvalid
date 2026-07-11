/* eslint-disable */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

let totalErrors = 0;

function logError(file, message) {
  console.error(`[GUARD-ARCH] [ERROR] ${file}: ${message}`);
  totalErrors++;
}

// Recursively traverse files
function walk(dir, filter, callback) {
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
        file !== 'tests' &&
        file !== 'release-evidence' &&
        file !== 'scratch'
      ) {
        walk(fullPath, filter, callback);
      }
    } else {
      if (filter(fullPath)) {
        callback(fullPath);
      }
    }
  });
}

const isSourceFile = (filePath) => {
  const ext = path.extname(filePath);
  return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.mjs';
};

console.log("[GUARD-ARCH] Running architecture regression checks...");

let clientInitializers = 0;
let adminInitializers = 0;

walk(rootDir, isSourceFile, (filePath) => {
  const relPath = path.relative(rootDir, filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // Skip this guard script and other check scripts
  if (relPath.startsWith('scripts/')) {
    return;
  }

  // 1. NextAuth / @auth imports
  if (content.includes('next-auth') || content.includes('@auth/')) {
    logError(relPath, "Contains banned next-auth or @auth import.");
  }
  if (content.includes('SessionProvider') || content.includes('useSession')) {
    logError(relPath, "Contains banned NextAuth SessionProvider or useSession.");
  }

  // 2. redirect authentication
  if (content.includes('signInWithRedirect') || content.includes('getRedirectResult')) {
    logError(relPath, "Contains banned signInWithRedirect or getRedirectResult method. Use signInWithPopup.");
  }

  // 3. window.open / window.closed in auth files
  if (relPath.includes('(auth)/')) {
    if (content.includes('window.open')) {
      logError(relPath, "Contains window.open in authentication files.");
    }
    if (content.includes('window.closed')) {
      logError(relPath, "Contains window.closed in authentication files.");
    }
  }

  // 4. decodeJwt / atob / firebase-admin in middleware
  if (relPath === 'middleware.ts') {
    if (content.includes('decodeJwt')) {
      logError(relPath, "Contains decodeJwt in middleware.ts.");
    }
    if (content.includes('atob')) {
      logError(relPath, "Contains atob in middleware.ts.");
    }
    if (content.includes('firebase-admin') || content.includes('@/lib/firebase/admin')) {
      logError(relPath, "Imports firebase-admin or admin module in middleware.ts.");
    }
  }

  // 5. firebase-admin in client components
  const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
  if (isClientComponent && (content.includes('firebase-admin') || content.includes('@/lib/firebase/admin'))) {
    logError(relPath, "Imports firebase-admin or admin modules inside a client component.");
  }

  // 6. verifyIdToken applied to session-cookie value or raw ID token cookie fallbacks
  if (relPath.includes('get-server-session.ts')) {
    if (content.includes('verifyIdToken')) {
      logError(relPath, "verifyIdToken is strictly forbidden in the session reader (get-server-session.ts). Only verifySessionCookie must be used.");
    }
  }

  // 7. Mock / fallback checks
  if (content.includes('isMocked') || content.includes('AUTH_ALLOW_MOCK')) {
    logError(relPath, "Contains reference to legacy isMocked or AUTH_ALLOW_MOCK.");
  }

  if (content.includes('offline decode') || content.includes('offline verification')) {
    logError(relPath, "Contains forbidden references to offline decode or verification.");
  }

  if (content.includes('raw ID token') || content.includes('cookieValue = idToken') || content.includes('cookieValue=idToken')) {
    logError(relPath, "Contains forbidden raw ID token fallback patterns.");
  }

  if (content.includes('mock adminAuth') || content.includes('mock adminDb') || content.includes('mockAdminAuth') || content.includes('mockAdminDb')) {
    logError(relPath, "Contains forbidden mock adminAuth or mock adminDb declarations declaration.");
  }

  // 8. Hardcoded admin email checks in auth/layout files
  if (content.includes('barisbagirlar@gmail.com')) {
    logError(relPath, "Contains hardcoded admin email \"barisbagirlar@gmail.com\". Use Custom Claims instead.");
  }

  // 8.1. Token split/dot check & strengthened E2E mock bypass rules
  if (
    content.includes('.split(".")') ||
    content.includes(".split('.')") ||
    content.includes('.split(/\\./)') ||
    content.includes("split(/\\./)") ||
    content.includes("token.split")
  ) {
    logError(relPath, "Contains banned token split operation (.split(\".\") / split(/\\./)).");
  }

  if (content.includes('base64url')) {
    logError(relPath, "Contains forbidden reference to base64url decode operation.");
  }

  if (content.includes('Buffer.from') && (content.includes('payload') || relPath.includes('get-server-session'))) {
    logError(relPath, "Contains forbidden Buffer.from JWT payload parsing pattern.");
  }

  // 8.2. Favicon-32.png check
  if (content.includes("favicon-32.png")) {
    logError(relPath, "Contains banned reference to legacy asset favicon-32.png.");
  }

  // 8.3. Duplicate session POST call sites check
  if (content.includes('"/api/auth/session"') || content.includes("'/api/auth/session'")) {
    if (
      relPath !== 'lib/auth/finalize-server-session.ts' &&
      relPath !== 'app/api/auth/session/route.ts' &&
      relPath !== 'middleware.ts' &&
      relPath !== 'app/(protected)/cbam/SignOutButton.tsx' &&
      relPath !== 'app/(protected)/admin/AdminClient.tsx' &&
      relPath !== 'context/AuthProvider.tsx'
    ) {
      logError(relPath, "Manually invokes the session API endpoint directly.");
    }
  }

  // 8.4. Static-only production output check
  if (relPath === 'next.config.ts' || relPath === 'next.config.js') {
    if (content.includes("output: 'export'") || content.includes('output: "export"')) {
      logError(relPath, "Banned static-only production output ('export'). Must use dynamic Node runtime handler.");
    }
  }

  // 9. token/credit grant in auth session route
  if (relPath === 'app/api/auth/session/route.ts') {
    if (content.includes('tokens:') || content.includes('credits:')) {
      logError(relPath, "Auth session route contains forbidden tokens/credits grant rules.");
    }
  }

  // 10. Legacy cookie names
  if (content.includes('cookies().get("session")') || content.includes('cookies().get(\'session\')') || content.includes('cookies().get("sessionCookie")')) {
    logError(relPath, "Uses deprecated session/sessionCookie name instead of SESSION_COOKIE_NAME.");
  }

  // 11. Multiple Firebase Client SDK initializers
  if (content.includes('initializeApp(') && !content.includes('firebase-admin') && !content.includes('firebase-admin/app')) {
    if (relPath !== 'lib/firebase/client.ts') {
      logError(relPath, "Initializes Client Firebase SDK directly. Must use client.ts.");
    }
    clientInitializers++;
  }

  // 12. Multiple Firebase Admin SDK initializers
  if (content.includes('initializeApp(') && (content.includes('firebase-admin') || content.includes('firebase-admin/app'))) {
    if (relPath !== 'lib/firebase/admin.ts') {
      logError(relPath, "Initializes Firebase Admin SDK directly. Must use admin.ts.");
    }
    adminInitializers++;
  }
});

// 13. Verify route runtime configuration and cache controls
const sessionRoutePath = 'app/api/auth/session/route.ts';
if (fs.existsSync(path.join(rootDir, sessionRoutePath))) {
  const content = fs.readFileSync(path.join(rootDir, sessionRoutePath), 'utf8');
  if (!content.includes('runtime = "nodejs"') && !content.includes("runtime = 'nodejs'")) {
    logError(sessionRoutePath, "Missing exact Node.js runtime declaration (runtime = \"nodejs\").");
  }
  if (!content.includes('dynamic = "force-dynamic"') && !content.includes("dynamic = 'force-dynamic'")) {
    logError(sessionRoutePath, "Missing force-dynamic cache control declaration.");
  }
}

// 14. Verify admin page uses AdminClient client gate
const adminPagePath = 'app/(protected)/admin/page.tsx';
if (fs.existsSync(path.join(rootDir, adminPagePath))) {
  const content = fs.readFileSync(path.join(rootDir, adminPagePath), 'utf8');
  if (!content.includes('AdminClient')) {
    logError(adminPagePath, "Admin page must render AdminClient directly.");
  }
}

// 15. Verify protected layout page uses client auth
const protectedLayoutPath = 'app/(protected)/layout.tsx';
if (fs.existsSync(path.join(rootDir, protectedLayoutPath))) {
  const content = fs.readFileSync(path.join(rootDir, protectedLayoutPath), 'utf8');
  if (!content.includes('useAuth(')) {
    logError(protectedLayoutPath, "Protected layout must call useAuth() to restrict access.");
  }
}

if (clientInitializers !== 1) {
  console.error(`[GUARD-ARCH] [ERROR] Expected exactly 1 Client Firebase SDK initializer, found: ${clientInitializers}`);
  totalErrors++;
}
if (adminInitializers !== 1) {
  console.error(`[GUARD-ARCH] [ERROR] Expected exactly 1 Firebase Admin SDK initializer, found: ${adminInitializers}`);
  totalErrors++;
}
if (totalErrors > 0) {
  console.error(`[GUARD-ARCH] [FAIL] Found ${totalErrors} architectural regression errors.`);
  process.exit(1);
} else {
  console.log("[GUARD-ARCH] [SUCCESS] Architectural validation passed successfully.");
  process.exit(0);
}
