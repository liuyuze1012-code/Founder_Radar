import { describe, expect, it } from "vitest";
import { fallbackReportTitle, needsReportTitle, validReportTitle } from "./report-title";

describe("Report title rules", () => {
  it("preserves short prompts exactly", () => {
    const prompt = "AI for medical imaging";
    expect(needsReportTitle(prompt)).toBe(false);
    expect(fallbackReportTitle(prompt)).toBe(prompt);
    expect(needsReportTitle("x".repeat(80))).toBe(false);
    expect(needsReportTitle("x".repeat(81))).toBe(true);
  });
  it("bounds the fallback for long prompts without changing their input", () => {
    const prompt = "Find researchers developing low-cost medical imaging tools for rural hospitals and affordable diagnosis in underserved communities.";
    expect(needsReportTitle(prompt)).toBe(true);
    expect(fallbackReportTitle(prompt).length).toBeLessThanOrEqual(80);
    expect(prompt.length).toBe(131);
  });
  it("rejects empty or overlong generated titles", () => {
    expect(validReportTitle("Affordable medical imaging for rural hospitals")).toBe(true);
    expect(validReportTitle(" ")).toBe(false);
    expect(validReportTitle("x".repeat(81))).toBe(false);
    expect(validReportTitle(Array(13).fill("word").join(" "))).toBe(false);
  });
});