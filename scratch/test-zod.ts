import { createNewCaseDraft } from "../lib/cbam/new-case";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";

try {
  const draft = createNewCaseDraft("test-user-123");
  console.log("Draft created client-side successfully.");
  
  // Simulate what saveCbamCase does: JSON serialize/deserialize to mimic HTTP network transmission
  const serialized = JSON.parse(JSON.stringify(draft));
  
  const parsed = AuditReadyCaseSchema.safeParse(serialized);
  if (!parsed.success) {
    console.error("Backend Zod validation failed!");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
  } else {
    console.log("Backend Zod validation passed!");
  }
} catch (e) {
  console.error("Error running test:", e);
}
