import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize using Application Default Credentials (ADC)
initializeApp();

const db = getFirestore();

async function main() {
  console.log("=== Querying paddle_events collection ===");
  const snap = await db.collection("paddle_events").orderBy("receivedAt", "desc").limit(5).get();
  
  if (snap.empty) {
    console.log("No paddle events found.");
    return;
  }
  
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`Event ID: ${doc.id}`);
    console.log(`- Type: ${data.eventType}`);
    console.log(`- Received At: ${data.receivedAt}`);
    console.log(`- State: ${data.processingState}`);
    console.log(`- Last Error: ${data.lastErrorCode || "None"}`);
    if (data.payload && data.payload.data) {
      console.log(`- Custom Data: ${JSON.stringify(data.payload.data.customData || data.payload.data.custom_data)}`);
      console.log(`- Status: ${data.payload.data.status}`);
    }
    console.log("------------------------");
  });
}

main().catch(err => {
  console.error("Error:", err);
});
