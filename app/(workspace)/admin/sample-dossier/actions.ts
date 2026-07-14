"use server";

import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { buildPdfDossier } from "@/functions/src/cbam/report/pdf-builder";
import { rasterizePdfToWebPBuffers } from "@/lib/pdf-rasterizer";
import { performDossierCalculations } from "@/lib/cbam/calculator";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export async function generateSampleDossierAction(version: string) {
  const adminClaims = await requireSuperAdmin();

  console.log(`[SAMPLE-GENERATOR] Triggered by ${adminClaims.email} for version ${version}`);

  try {
    // 1. Load Fixture
    const fixturePath = path.resolve(process.cwd(), "tests/fixtures/cbam/sample-dossier-v1.json");
    const caseData = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

    // 2. Perform Calculations
    const calcResult = performDossierCalculations(caseData);

    // 3. Build Canonical PDF (with Redaction)
    const pdfBuffer = buildPdfDossier(caseData, calcResult as any, "SAMPLE-DOSSIER-V1", true, true);
    
    // 4. Rasterize Pages
    const pageBuffers = await rasterizePdfToWebPBuffers(pdfBuffer);

    // 5. Upload to Storage
    const bucket = getAdminStorageBucket();
    const canonicalPath = `sample-dossiers/private/${version}/canonical.pdf`;
    
    await bucket.file(canonicalPath).save(pdfBuffer, { contentType: "application/pdf" });

    // Ensure we delete any existing public pages for this version
    const [existingFiles] = await bucket.getFiles({ prefix: `sample-dossiers/public/${version}/pages/` });
    await Promise.all(existingFiles.map(f => f.delete()));

    const pageUrls: string[] = [];
    
    for (let i = 0; i < pageBuffers.length; i++) {
      const pageNum = (i + 1).toString().padStart(3, "0");
      const pagePath = `sample-dossiers/public/${version}/pages/page-${pageNum}.png`;
      
      const file = bucket.file(pagePath);
      await file.save(pageBuffers[i], { 
        contentType: "image/png",
        metadata: { cacheControl: "public, max-age=31536000" } 
      });
      await file.makePublic();
      
      pageUrls.push(`https://storage.googleapis.com/${bucket.name}/${pagePath}`);
    }

    // 6. Update Manifest in Firestore
    const canonicalHash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
    
    await adminDb.collection("sample_dossiers").doc(version).set({
      version,
      state: "GENERATED",
      generatedAt: new Date().toISOString(),
      generatedBy: adminClaims.uid,
      canonicalHash,
      pageCount: pageBuffers.length,
      pageUrls,
    });

    return { success: true, pageCount: pageBuffers.length };

  } catch (error: any) {
    console.error("[SAMPLE-GENERATOR] Error:", error);
    return { success: false, error: error.message };
  }
}
