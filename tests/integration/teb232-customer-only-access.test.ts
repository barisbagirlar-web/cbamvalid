import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("Teb232 customer-only access", () => {
  it("is absent from every admin bootstrap allowlist", () => {
    const superAdmin = read("scripts/bootstrap-super-admin.ts");
    const ownerAdmin = read("functions/scripts/bootstrap-owner-admin.ts");

    expect(superAdmin).not.toContain('"teb232@gmail.com"');
    expect(ownerAdmin).not.toContain('"teb232@gmail.com"');
    expect(superAdmin).toContain('"barisbagirlar@gmail.com"');
    expect(ownerAdmin).toContain('"barisbagirlar@gmail.com"');
  });

  it("is absent from the hidden test-admin entitlement bypass", () => {
    const access = read("functions/src/commerce/test-admin-access.ts");
    expect(access).not.toContain('"teb232@gmail.com"');
    expect(access).toContain('"barisbagirlar@gmail.com"');
  });

  it("has a fail-closed conversion script with customer credits", () => {
    const script = read("scripts/demote-teb232-to-customer.ts");
    expect(script).toContain('TARGET_EMAIL = "teb232@gmail.com"');
    expect(script).toContain('TARGET_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652"');
    expect(script).toContain("TARGET_CREDITS = 100_000");
    expect(script).toContain('currentClaims.role = "customer"');
    expect(script).toContain('transaction.delete(adminIdentityRef)');
    expect(script).toContain('status: "REVOKED"');
    expect(script).toContain('TEB232_CUSTOMER_CONVERSION=PASS');
  });
});
