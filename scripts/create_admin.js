/* eslint-disable */
const fs = require("fs");
const path = require("path");

// Load modular admin SDK imports normally since this runs inside the workspace
const { getApps, initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

// Manually parse .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const match = line.trim().match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

if (getApps().length === 0) {
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  } else {
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "cbam-projesi"
    });
  }
}

const auth = getAuth();
const db = getFirestore();

async function run() {
  const email = "barisbagirlar@gmail.com";
  const password = "Deneme1974";
  
  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log("Kullanıcı zaten mevcut. UID:", userRecord.uid);
    } catch (e) {
      userRecord = await auth.createUser({
        email: email,
        password: password,
      });
      console.log("Yeni kullanıcı oluşturuldu. UID:", userRecord.uid);
    }

    await db.collection("users").doc(userRecord.uid).set({
      email: email,
      tokens: 100,
      role: "admin",
      createdAt: new Date().toISOString()
    }, { merge: true });

    console.log("Firestore profil güncellendi: role='admin', tokens=100");
  } catch (err) {
    console.error("Hata:", err.message || err);
  }
}

run();
