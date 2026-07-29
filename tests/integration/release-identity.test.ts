import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/release/route";

const ORIGINAL_SHA = process.env.NEXT_PUBLIC_CBAM_RELEASE_SHA;

afterEach(() => {
  if (ORIGINAL_SHA === undefined) {
    delete process.env.NEXT_PUBLIC_CBAM_RELEASE_SHA;
  } else {
    process.env.NEXT_PUBLIC_CBAM_RELEASE_SHA = ORIGINAL_SHA;
  }
});

describe("release identity endpoint", () => {
  it("returns the exact full build commit", async () => {
    const sha = "a".repeat(40);
    process.env.NEXT_PUBLIC_CBAM_RELEASE_SHA = sha;
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "PASS",
      commitSha: sha,
      service: "ssrcbamdesk",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("fails closed when the build identity is absent or malformed", async () => {
    process.env.NEXT_PUBLIC_CBAM_RELEASE_SHA = "NOT_PROVEN";
    const response = await GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "NOT_PROVEN",
      commitSha: "NOT_PROVEN",
    });
  });
});
