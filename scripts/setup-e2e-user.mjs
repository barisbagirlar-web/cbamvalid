import admin from "firebase-admin";

const b64 = process.env.ADMIN_SERVICE_ACCOUNT_B64 || process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_B64;
if (!b64) throw new Error("Missing ADMIN_SERVICE_ACCOUNT_B64");

const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function setupE2E() {
  const email = "e2e@cbamvalid.com";
  const password = "password123";
  let uid;

  try {
    const user = await auth.getUserByEmail(email);
    uid = user.uid;
    await auth.updateUser(uid, { password });
    console.log("Updated existing E2E user:", uid);
  } catch (e) {
    if (e.code === "auth/user-not-found") {
      const user = await auth.createUser({
        email,
        password,
        displayName: "E2E Tester"
      });
      uid = user.uid;
      console.log("Created new E2E user:", uid);
    } else {
      throw e;
    }
  }

  // Ensure Firestore documents exist
  await db.collection("users").doc(uid).set({
    email,
    role: "user",
    tokens: 100,
    credits: 100
  }, { merge: true });

  await db.collection("users").doc(uid).collection("creditSummary").doc("current").set({
    availableCredits: 100
  }, { merge: true });

  console.log("E2E user setup complete!");
}

setupE2E().catch(console.error);
