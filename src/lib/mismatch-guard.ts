export const CONFIDENCE_THRESHOLD = 0.6;
export const SIMILARITY_THRESHOLD = 0.55; // tuned against the real eval set — see BUILDLOG.md for the reasoning

export type GuardInput = {
  imageConfidence: number;
  imageCategory: string;
  expectedCategory: string;
  similarityScore: number;
};

export type GuardResult = {
  approved: boolean;
  reason: string;
};

/**
 * Checked in this order; the first failing check determines the
 * rejection reason. All three must pass for a suggestion to be
 * approved. This is the production-critical part of the whole system —
 * refusing a bad match matters more than finding a good one.
 */
export function evaluateGuard(input: GuardInput): GuardResult {
  if (input.imageConfidence < CONFIDENCE_THRESHOLD) {
    return {
      approved: false,
      reason: `Low-confidence classification (${input.imageConfidence.toFixed(2)})`,
    };
  }

  if (input.imageCategory !== input.expectedCategory) {
    return {
      approved: false,
      reason: `Category mismatch: expected ${input.expectedCategory}, detected ${input.imageCategory}`,
    };
  }

  if (input.similarityScore < SIMILARITY_THRESHOLD) {
    return {
      approved: false,
      reason: `Similarity below threshold (${input.similarityScore.toFixed(2)})`,
    };
  }

  return { approved: true, reason: "Confident match" };
}
