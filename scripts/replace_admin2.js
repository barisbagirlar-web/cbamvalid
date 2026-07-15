const fs = require('fs');
const files = [
  "app/(protected)/cbam/new/page.tsx",
  "app/(protected)/cbam/page.tsx",
  "app/(protected)/dashboard/reports/page.tsx",
  "app/api/cbam/cases/route.ts",
  "lib/commerce/webhook-processor.ts"
];

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace remaining bare adminDb usages with getAdminDb()
    // but don't match getAdminDb()
    content = content.replace(/\badminDb\b(?!\()/g, 'getAdminDb()');
    
    fs.writeFileSync(file, content);
    console.log("Updated", file);
  } catch (err) {
    console.error("Error on", file, err.message);
  }
}
