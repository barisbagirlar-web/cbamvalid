import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedTypeDirectories = [
  path.join(root, ".next", "types"),
  path.join(root, ".next", "dev", "types"),
];

for (const directory of generatedTypeDirectories) {
  fs.rmSync(directory, { recursive: true, force: true });
}

console.log("NEXT_ROUTE_TYPE_CACHE_CLEAN=PASS");
