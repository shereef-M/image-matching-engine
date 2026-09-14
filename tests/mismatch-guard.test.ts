import { describe, it, expect } from "vitest";
import { evaluateGuard } from "../src/lib/mismatch-guard";

describe("evaluateGuard", () => {
  it("approves a confident, correct-category match", () => {
    const result = evaluateGuard({
      imageConfidence: 0.95,
      imageCategory: "fox",
      expectedCategory: "fox",
      similarityScore: 0.8,
    });
    expect(result.approved).toBe(true);
  });

  it("rejects the exact fox/wolf mismatch scenario from the brief", () => {
    const result = evaluateGuard({
      imageConfidence: 0.9,
      imageCategory: "wolf",
      expectedCategory: "fox",
      similarityScore: 0.75, // even with high similarity, category mismatch wins
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("Category mismatch");
    expect(result.reason).toContain("expected fox");
    expect(result.reason).toContain("detected wolf");
  });

  it("rejects a low-confidence image even with matching category and high similarity", () => {
    const result = evaluateGuard({
      imageConfidence: 0.4,
      imageCategory: "fox",
      expectedCategory: "fox",
      similarityScore: 0.9,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("Low-confidence");
  });

  it("rejects correct category, high confidence, but similarity below threshold", () => {
    const result = evaluateGuard({
      imageConfidence: 0.9,
      imageCategory: "fox",
      expectedCategory: "fox",
      similarityScore: 0.3,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain("Similarity below threshold");
  });

  it("checks confidence before category (order matters for the reason given)", () => {
    const result = evaluateGuard({
      imageConfidence: 0.3,
      imageCategory: "wolf",
      expectedCategory: "fox",
      similarityScore: 0.9,
    });
    expect(result.reason).toContain("Low-confidence");
    expect(result.reason).not.toContain("Category mismatch");
  });
});
