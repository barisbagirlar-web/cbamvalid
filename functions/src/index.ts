import { setGlobalOptions } from "firebase-functions/v2";

// Set maximum timeout and memory for all functions
setGlobalOptions({
  region: "europe-west1",
  maxInstances: 10,
});

export * from "./handlers/cases";
export * from "./handlers/reports";
export * from "./handlers/commerce";
export * from "./webhook";
