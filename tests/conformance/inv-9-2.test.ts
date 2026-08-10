import { describe, expect, it } from "vitest";
import { validateStructuralBreakJoin } from "../../scripts/seo/warehouse-contract";

describe("INV-9.2 structural break isolation", () => {
  it("rejects a cohort that spans both sides of 2025-09-11", () => {
    const errors = validateStructuralBreakJoin([
      { date: "2025-09-10", cohortId: "same-cohort", metric: "clicks", value: 10 },
      { date: "2025-09-11", cohortId: "same-cohort", metric: "clicks", value: 11 },
    ]);
    expect(errors.some((error) => error.includes("crosses 2025-09-11"))).toBe(true);
  });

  it("accepts explicit split cohort ids across the structural break", () => {
    expect(
      validateStructuralBreakJoin([
        { date: "2025-09-10", cohortId: "cohort-pre", metric: "clicks", value: 10 },
        { date: "2025-09-11", cohortId: "cohort-post", metric: "clicks", value: 11 },
      ]),
    ).toEqual([]);
  });
});
