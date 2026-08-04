/**
 * Regression coverage for the software-only positioning guard
 * (scripts/guard-software-only-positioning.mjs).
 *
 * The guard must reject affirmative human-service sales copy while allowing
 * explicit negative legal boundaries (e.g. "no government or professional
 * services", EXCLUDED scope lists) that Paddle requires on the public
 * commercial surfaces.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const GUARD = path.join(ROOT, "scripts", "guard-software-only-positioning.mjs");

function runGuard(env: Record<string, string> = {}): string {
  return execFileSync(process.execPath, [GUARD], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("software-only positioning guard", () => {
  it("passes when negative legal boundaries use human-service phrases", () => {
    // The live pages contain these negative boundaries (Paddle appeal surface).
    const output = runGuard();
    expect(output).toContain("SOFTWARE_ONLY_POSITIONING_GUARD=PASS");
  });

  it("still fails on affirmative human-service sales copy", () => {
    // Stage an affirmative claim on a synthetic public surface inside the
    // scanned tree, then confirm the guard rejects it.
    const staged = path.join(
      ROOT,
      "app",
      "(public)",
      "__guard_staged_affirmative__.tsx"
    );
    try {
      fs.writeFileSync(
        staged,
        'export default function StagedPage() { return <main>Talk to an expert for Professional services.</main>; }\n'
      );
      expect(() => runGuard()).toThrow();
    } finally {
      fs.rmSync(staged, { force: true });
    }
  });

  it("still fails on positive use of a forbidden phrase without a negative boundary", () => {
    // A line in the scanned tree that uses "Professional services" without a
    // negative marker must be flagged even after the negative-boundary fix.
    const staged = path.join(ROOT, "app", "(public)", "__guard_staged_no_neg__.tsx");
    try {
      fs.writeFileSync(
        staged,
        'export default function StagedPage() { return <main>Professional services are available on request.</main>; }\n'
      );
      expect(() => runGuard()).toThrow();
    } finally {
      fs.rmSync(staged, { force: true });
    }
  });
});
