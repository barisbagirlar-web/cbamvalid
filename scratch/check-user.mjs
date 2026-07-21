import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

process.env.GCLOUD_PROJECT = "cbam-desk";

const app = initializeApp({
  projectId: "cbam-desk"
});

const auth = getAuth(app);

async function main() {
  const user = await auth.getUser("r3Sv0U5YqEcLLylbw5ndwK1Zg652");
  console.log("User email:", user.email);
}

main().catch(console.error);
