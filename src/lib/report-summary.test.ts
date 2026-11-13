import { describe, expect, it } from "vitest";
import { ideaInput, selectIdeaRecord, validCardSummary } from "./report-summary";

describe("Report summary constraints", () => {
  it("accepts seven- and eight-word ideas, but rejects longer or shorter ideas", () => {
    const qualification = "Sixteen company-authored papers cite this research.";
    expect(validCardSummary({ idea: "Robot navigation software that improves perceived competence", qualification })).toBe(true);
    expect(validCardSummary({ idea: "Robot navigation software that improves perceived human competence", qualification })).toBe(true);
    expect(validCardSummary({ idea: "Robot navigation software", qualification })).toBe(false);
    expect(validCardSummary({ idea: "Robot navigation software that improves perceived human competence automatically", qualification })).toBe(false);
  });
  it("uses a paper abstract without requiring a startup case", () => {
    const paper = { source: "paper", source_id: "W1", title: "Radar", summary: "Adaptive radar detects hidden space debris.", fit: 8 };
    expect(ideaInput(selectIdeaRecord([paper]), null)).toContain(paper.summary);
    expect(ideaInput(paper, "A different speculative product")).not.toContain("speculative");
  });
  it("uses the grant project abstract as idea evidence", () => {
    const grant = { source: "grant", source_id: "nsf:1", title: "I-Corps", summary: "Commercializing a sensor for detecting water contamination.", fit: 9 };
    expect(ideaInput(grant, null)).toContain(grant.summary);
  });
  it("uses repository description or README content as idea evidence", () => {
    const repo = { source: "repo", source_id: "gh:org/tool", title: "org/tool", summary: "README: Software that schedules radar observations.", fit: 8 };
    expect(ideaInput(repo, null)).toContain(repo.summary);
  });
  it("prefers described records, then the highest thesis fit", () => {
    const base = { source: "paper", source_id: "W1", title: "Radar", summary: "Radar observations", fit: 8 };
    expect(selectIdeaRecord([{ ...base, summary: null, fit: 10 }, base, { ...base, source_id: "W2", fit: 9 }])?.source_id).toBe("W2");
  });
  it("falls back to a saved product, then a source title when no abstract exists", () => {
    const record = { source: "paper", source_id: "W1", title: "Hidden debris detection", summary: null, fit: 8 };
    expect(ideaInput(record, "A debris detection service")).toContain("A debris detection service");
    expect(ideaInput(record, null)).toContain(record.title);
    expect(ideaInput(undefined, null)).toBeNull();
  });
});