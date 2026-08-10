import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * G-20 — resolves the Python interpreter that carries the `cryptography`
 * dependency. Prefers the repository-local `.venv` (created via
 * `python3 -m venv .venv && .venv/bin/pip install -r scripts/verify/requirements.txt`),
 * falling back to `python3` so CI can provide `PYTHON_BIN` explicitly.
 */
function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const venvPython = join(process.cwd(), ".venv", "bin", "python");
  return existsSync(venvPython) ? venvPython : "python3";
}

export const PYTHON_BIN = resolvePythonBin();
