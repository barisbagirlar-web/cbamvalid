import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Teb232 test-administrator access (not a bootstrap admin)", () => {
  it("is absent from every admin bootstrap allowlist", () => {
    const superAdmin = read("scripts/bootstrap-super-admin.ts");
    const ownerAdmin = read("functions/scripts/bootstrap-owner-admin.ts");

    expect(superAdmin).not.toContain('"teb232@gmail.com"');
    expect(ownerAdmin).not.toContain('"teb232@gmail.com"');
    expect(superAdmin).toContain('"barisbagirlar@gmail.com"');
    expect(ownerAdmin).toContain('"barisbagirlar@gmail.com"');
  });

  it("is present in the test-admin entitlement bypass allowlist (unlimited test balance)", () => {
    const access = read("functions/src/commerce/test-admin-access.ts");
    expect(access).toContain('"teb232@gmail.com"');
    expect(access).toContain('"barisbagirlar@gmail.com"');
    expect(access).toContain("Number.MAX_SAFE_INTEGER");
  });

  it("keeps the client-safe allowlist mirror aligned", () => {
    const mirror = read("lib/commerce/test-admin-emails.ts");
    expect(mirror).toContain('"teb232@gmail.com"');
    expect(mirror).toContain('"barisbagirlar@gmail.com"');
  });

  it("does not ship the obsolete customer-only conversion script", () => {
    expect(
      fs.existsSync(path.join(root, "scripts/demote-teb232-to-customer.ts"))
    ).toBe(false);
  });
});
