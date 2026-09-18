import { describe, expect, it } from "vitest";
import { draftKey, isLikelyNetworkError } from "@/lib/offline/network";

describe("offline helpers F6", () => {
  it("detects common network error messages", () => {
    expect(isLikelyNetworkError(new Error("Failed to fetch"))).toBe(true);
    expect(isLikelyNetworkError(new TypeError("NetworkError when attempting to fetch resource."))).toBe(
      true,
    );
    expect(isLikelyNetworkError(new Error("Load failed"))).toBe(true);
    expect(isLikelyNetworkError(new Error("Validation failed"))).toBe(false);
  });

  it("builds stable draft keys", () => {
    expect(draftKey("org_1", "odo_2")).toBe("org_1:odo_2");
  });
});
