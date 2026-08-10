import { describe, expect, it } from "vitest";
import { assertRegisteredTemplate } from "../../scripts/seo/templates";

describe("INV-18.1 registered template", () => {
  it("rejects an unregistered template", () => {
    expect(() => assertRegisteredTemplate("unregistered-template")).toThrow(/INV-18\.1/);
  });
});
