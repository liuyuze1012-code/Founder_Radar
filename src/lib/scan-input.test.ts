import { describe, expect, it } from "vitest";
import { startInput, scanInputError } from "./scan-input";

const input = { thesis: "AI for drug discovery", schoolIds: ["dc"], windowDays: 60, laneSizes: { pre_intent: 5, exploring: 3, already_moving: 2 }, passcode: "test" };

describe("scan start validation", () => {
  it("accepts valid scan settings", () => {
    expect(startInput.parse(input)).toEqual(input);
  });
  it("reports an oversized thesis instead of a generic scan failure", () => {
    expect(startInput.safeParse({ ...input, thesis: "a".repeat(500) }).success).toBe(true);
    const result = startInput.safeParse({ ...input, thesis: "a".repeat(501) });
    expect(result.success).toBe(false);
    if (!result.success) expect(scanInputError(result.error)).toContain("500");
  });
  it("rejects fractional lane sizes with an actionable error", () => {
    const result = startInput.safeParse({ ...input, laneSizes: { ...input.laneSizes, exploring: 1.5 } });
    expect(result.success).toBe(false);
    if (!result.success) expect(scanInputError(result.error)).toContain("whole number");
  });
});