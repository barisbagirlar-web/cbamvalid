import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import cbamCompliance from "./eslint-plugins/cbam-compliance/index.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // CBAM Compliance — regulatory invariants on calculation paths
  cbamCompliance.configs['cbam-files'],
  {
    plugins: { "cbam-compliance": cbamCompliance },
    rules: {
      "cbam-compliance/require-eu-ref": "error",
      "cbam-compliance/no-float-arithmetic": "error",
      "cbam-compliance/no-hardcoded-emission-factor": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plugin internals
    "eslint-plugins/**",
  ]),
]);

export default eslintConfig;
