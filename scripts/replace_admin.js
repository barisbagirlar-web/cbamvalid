const fs = require('fs');
const files = [
  "app/(protected)/dashboard/reports/page.tsx",
  "app/(protected)/cbam/new/page.tsx",
  "app/(protected)/cbam/page.tsx",
  "app/(protected)/cbam/reports/[reportId]/page.tsx",
  "app/api/verify/[documentHash]/route.ts",
  "app/api/health/commerce/route.ts",
  "app/api/admin/tokens/route.ts",
  "app/api/checkout/cbam/route.ts",
  "app/api/cbam/cases/route.ts",
  "app/api/cbam/reports/[reportId]/download/route.ts",
  "app/api/cbam/reports/[reportId]/route.ts",
  "app/api/webhooks/paddle/route.ts",
  "lib/commerce/refund-service.ts",
  "lib/commerce/webhook-processor.ts",
  "lib/commerce/order-service.ts",
  "lib/commerce/entitlement-service.ts",
  "lib/commerce/ledger-service.ts",
  "lib/cbam/storage/case-repository.ts",
  "lib/cbam/report/seal-service.ts"
];

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace import { ..., adminDb, ... }
    content = content.replace(/import\s+\{([^}]*?)\badminDb\b([^}]*?)\}\s+from\s+['"]([^'"]+firebase\/admin)['"]/g, (match, p1, p2, p3) => {
      // Ensure we don't accidentally double-add getAdminDb if it's already there
      let newImports = p1 + "getAdminDb" + p2;
      if (newImports.includes("getAdminDb, getAdminDb")) {
         newImports = newImports.replace("getAdminDb, getAdminDb", "getAdminDb");
      }
      return `import {${newImports}} from "${p3}"`;
    });
    
    // Replace usages: adminDb.collection -> getAdminDb().collection
    content = content.replace(/\badminDb\./g, 'getAdminDb().');
    
    fs.writeFileSync(file, content);
    console.log("Updated", file);
  } catch (err) {
    console.error("Error on", file, err.message);
  }
}
