const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// We need to load env vars manually

if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
  console.error("Missing FIREBASE_ADMIN_PROJECT_ID in .env.local");
  process.exit(1);
}

initializeApp({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  })
});

async function ensureE2eUser() {
  const email = "e2e@cbamvalid.com";
  const password = "password123";
  
  try {
    const user = await getAuth().getUserByEmail(email);
    console.log(`User ${email} already exists with uid: ${user.uid}`);
    // Update password just in case
    await getAuth().updateUser(user.uid, { password });
    console.log("Password updated successfully.");
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      const newUser = await getAuth().createUser({
        email,
        password,
        displayName: 'E2E User',
        emailVerified: true,
      });
      console.log(`Created user ${email} with uid: ${newUser.uid}`);
    } else {
      console.error("Error checking/creating user:", error);
    }
  }
}

ensureE2eUser().then(() => process.exit(0)).catch(console.error);
