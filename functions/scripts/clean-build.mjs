import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const functionsRoot = path.resolve(scriptDirectory, "..");
const buildDirectory = path.join(functionsRoot, "build");

fs.rmSync(buildDirectory, { recursive: true, force: true });

console.log("FUNCTIONS_BUILD_CLEAN=PASS");
