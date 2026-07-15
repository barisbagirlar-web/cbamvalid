#!/bin/bash
sed -i '' 's|\.\./\.\./catalog|@/commerce/catalog|g' src/commerce/paddle/checkout-service.ts
sed -i '' 's|\.\./cbam/regulatory|@/cbam/regulatory|g' src/firestore-validator.ts
sed -i '' 's|getAdminDb()|adminDb|g' src/commerce/paddle/checkout-service.ts
cat << 'INNER_EOF' >> src/cbam/storage/case-repository.ts

export async function getCasesForUser(uid: string): Promise<CbamCase[]> {
  validateIdentifier("uid", uid);
  const snapshot = await adminDb.collection("cbam_cases").where("uid", "==", uid).get();
  return snapshot.docs.map(doc => doc.data() as CbamCase);
}
INNER_EOF
