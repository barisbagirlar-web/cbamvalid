import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Teb232 visible Cases navigation", () => {
  it("exposes Cases as the visible customer workspace menu destination", () => {
    const navigation = read("lib/navigation.ts");
    expect(navigation).toContain('{ label: "Cases", href: "/cases" }');
    expect(navigation).not.toContain('{ label: "Working files", href: "/cases" }');
  });

  it("projects only the exact controlled identity out of the client admin menu", () => {
    const helper = read("lib/auth/controlled-workspace-account.ts");
    const provider = read("context/AuthProvider.tsx");

    expect(helper).toContain('CONTROLLED_WORKSPACE_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652"');
    expect(helper).toContain('CONTROLLED_WORKSPACE_EMAIL = "teb232@gmail.com"');
    expect(helper).toContain("admin: false");
    expect(helper).toContain("ownerAdmin: false");
    expect(provider).toContain("projectClientWorkspaceClaims(currentUser, tokenResult.claims)");
  });

  it("sends the exact controlled account directly to Cases after login", () => {
    const routing = read("lib/auth/post-login-routing.ts");
    expect(routing).toContain("isControlledWorkspaceAccount(user)");
    expect(routing).toContain('return "/cases";');
  });
});
