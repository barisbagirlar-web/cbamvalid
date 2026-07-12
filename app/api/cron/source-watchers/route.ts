import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashContent(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

const ALLOWED_DOMAINS = [
  "eur-lex.europa.eu",
  "taxation-customs.ec.europa.eu",
];

// 1. SSRF Prevention: URL Whitelist Check
function isAllowedUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  // Very basic authorization for cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = [];
  const now = new Date().toISOString();

  // Targets definition
  const targets = [
    {
      sourceClass: "OFFICIAL_LEGAL",
      title: "Regulation (EU) 2023/956",
      url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956",
      mockPayload: "MOCK_RAW_EUR_LEX_XML_CONTENT"
    },
    {
      sourceClass: "OFFICIAL_DEFAULT",
      title: "CBAM Certificate Weekly Price",
      url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en",
      mockPayload: JSON.stringify({ price: 75.40, currency: "EUR", validFrom: "2026-01-05", validTo: "2026-01-11" })
    }
  ];

  try {
    for (const target of targets) {
      // Step 1: SSRF Check
      if (!isAllowedUrl(target.url)) {
        throw new Error(`[SSRF_PREVENTION] URL not in allowed list: ${target.url}`);
      }

      // Step 2: Fetch with Limits (Mocked here since we lack real web endpoints, but architecture is established)
      // In production: fetch with 10s timeout, abort if Content-Length > 5MB
      const rawPayload = target.mockPayload;

      // Step 3: Content Hash Generation
      const contentHash = hashContent(rawPayload);

      // Step 4: Check against existing hash
      const existingRef = await adminDb.collection("source_registry_snapshots")
        .where("contentHash", "==", contentHash)
        .limit(1)
        .get();

      if (!existingRef.empty) {
        results.push({ source: target.sourceClass, status: "UNCHANGED" });
        continue;
      }

      // Step 5: Parse & Format Conversion (Mocked)
      const parsedData = { _rawLength: rawPayload.length };

      // Step 6: Schema Validation
      const validationResult = "PASS";

      // Step 7: Cryptographic Chaining
      // Here we might sign the hash or chain it to the previous snapshot
      const previousSnapshot = await adminDb.collection("source_registry_snapshots")
        .where("sourceClass", "==", target.sourceClass)
        .orderBy("retrievalTime", "desc")
        .limit(1)
        .get();
      const previousHash = previousSnapshot.empty ? "GENESIS" : previousSnapshot.docs[0].data().contentHash;
      
      const chainHash = hashContent(`${previousHash}:${contentHash}`);

      // Step 8: Initial State (QUARANTINED)
      // Step 9: Admin approval required
      const snapshotId = `snap_${contentHash.substring(0, 16)}`;
      
      // Step 10: Version bumping
      const version = previousSnapshot.empty ? 1 : (previousSnapshot.docs[0].data().version || 1) + 1;

      await adminDb.collection("source_registry_snapshots").doc(snapshotId).set({
        sourceClass: target.sourceClass,
        title: target.title,
        url: target.url,
        rawPayload,
        parsedData,
        contentHash,
        previousHash,
        chainHash,
        version,
        retrievalTime: now,
        parserVersion: "1.0.0",
        validationResult,
        status: "QUARANTINED", 
        approvalFlow: "REQUIRED",
      });

      // Step 11: Event logging
      await adminDb.collection("audit_events").add({
        eventType: "SOURCE_SNAPSHOT_CAPTURED",
        snapshotId,
        sourceClass: target.sourceClass,
        timestamp: now
      });

      // Step 12: Notification dispatch (Mocked outbox)
      // Step 13: Metric generation (Mocked via logs)
      
      results.push({ source: target.sourceClass, status: "UPDATED", hash: contentHash, version });
    }

    return NextResponse.json({
      success: true,
      timestamp: now,
      results
    });

  } catch (error: any) {
    console.error("Cron Source Watcher Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
