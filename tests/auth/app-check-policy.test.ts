import { describe, expect, it } from "vitest";
import { resolveAppCheckEnforcement } from "../../functions/src/app-check-policy";

describe("callable App Check deployment policy", () => {
  it("does not reject authenticated production traffic when no provider is configured", () => {
    expect(resolveAppCheckEnforcement(undefined, false)).toBe(false);
  });

  it("enables enforcement only when production configuration explicitly opts in", () => {
    expect(resolveAppCheckEnforcement("false", false)).toBe(false);
    expect(resolveAppCheckEnforcement("true", false)).toBe(true);
  });

  it("keeps emulator callable traffic usable", () => {
    expect(resolveAppCheckEnforcement("true", true)).toBe(false);
  });
});
