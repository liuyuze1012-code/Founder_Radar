import { describe, expect, it } from "vitest";
import { validCardSummary } from "./report-summary";

describe("Report summary constraints", () => {
  it("accepts seven- and eight-word ideas, but rejects longer or shorter ideas", () => {
    const qualification = "Sixteen company-authored papers cite this research.";
    expect(validCardSummary({ idea: "Robot navigation software that improves perceived competence", qualification })).toBe(true);
    expect(validCardSummary({ idea: "Robot navigation software that improves perceived human competence", qualification })).toBe(true);
    expect(validCardSummary({ idea: "Robot navigation software", qualification })).toBe(false);
    expect(validCardSummary({ idea: "Robot navigation software that improves perceived human competence automatically", qualification })).toBe(false);
  });
});