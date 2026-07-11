import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import {
  getAuth,
} from "firebase-admin/auth";

const encoded =
  process.env
    .ADMIN_SERVICE_ACCOUNT_B64;

const email =
  process.env.ADMIN_BOOTSTRAP_EMAIL;

if (!encoded || !email) {
  throw new Error(
    "ADMIN_BOOTSTRAP_CONFIGURATION_MISSING"
  );
}

const raw = JSON.parse(
  Buffer.from(
    encoded,
    "base64"
  ).toString("utf8")
);

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: raw.project_id,
      clientEmail: raw.client_email,
      privateKey: raw.private_key,
    }),
  });

const auth = getAuth(app);
const user =
  await auth.getUserByEmail(email);

await auth.setCustomUserClaims(
  user.uid,
  {
    ...(user.customClaims ?? {}),
    admin: true,
  }
);

await auth.revokeRefreshTokens(
  user.uid
);

console.log(
  JSON.stringify({
    result:
      "ADMIN_CLAIM_SET",
    uid: user.uid,
  })
);
