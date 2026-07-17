import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

async function main() {
  console.log("=== Querying for teb232 ===");
  
  // Search users collection
  const usersSnap = await db.collection("users").get();
  console.log("Checking users...");
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id.includes("teb232") || JSON.stringify(data).includes("teb232")) {
      console.log(`FOUND USER: ${doc.id} =>`, data);
    }
  });

  // Search cases collection
  const casesSnap = await db.collection("cases").get();
  console.log("Checking cases...");
  casesSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id.includes("teb232") || JSON.stringify(data).includes("teb232")) {
      console.log(`FOUND CASE: ${doc.id} =>`, data);
    }
  });

  // Search commerce_orders collection
  const ordersSnap = await db.collection("commerce_orders").get();
  console.log("Checking orders...");
  ordersSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id.includes("teb232") || JSON.stringify(data).includes("teb232")) {
      console.log(`FOUND ORDER: ${doc.id} =>`, data);
    }
  });
}

main().catch(err => {
  console.error("Error:", err);
});
