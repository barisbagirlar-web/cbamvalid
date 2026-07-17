import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

async function main() {
  console.log("=== Querying recent orders ===");
  const snap = await db.collection("commerce_orders").orderBy("createdAt", "desc").limit(5).get();
  
  if (snap.empty) {
    console.log("No orders found.");
    return;
  }
  
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`Order ID: ${doc.id}`);
    console.log(`- UID: ${data.uid}`);
    console.log(`- Status: ${data.status}`);
    console.log(`- Created At: ${data.createdAt}`);
    console.log(`- Updated At: ${data.updatedAt}`);
    console.log(`- Price ID: ${data.priceId}`);
    console.log(`- Transaction ID: ${data.paddleTransactionId || "None"}`);
    console.log("------------------------");
  });
}

main().catch(err => {
  console.error("Error:", err);
});
