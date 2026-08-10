import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { noFloatInHashedFields } from "./scripts/lint/no-float-in-hashed-fields.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // G-16 — monetary/emissions/rates entering hashes must be string-encoded
  // fixed-point decimals, never IEEE 754 numbers.
  {
    files: ["functions/src/**/*.{ts,tsx}"],
    plugins: { cbamvalid: { rules: { "no-float-in-hashed-fields": noFloatInHashedFields } } },
    rules: { "cbamvalid/no-float-in-hashed-fields": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
