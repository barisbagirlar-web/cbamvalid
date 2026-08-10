import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // The G-xx gate tests build complete sealed packages end-to-end: padded
    // evidence PDFs, the rendered Enterprise Compliance Master Record and
    // pdfjs text extraction. Under full-suite parallel load that genuinely takes
    // longer than the 5s vitest default; the assertions are unchanged.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**", "**/functions/build/**", "**/functions/lib/**"],
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
