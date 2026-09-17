import { embedText } from "./gemini";
import { cosineSimilarity } from "./similarity";

const CATEGORIES = ["fox", "wolf", "dog", "bear"] as const;
export type Category = (typeof CATEGORIES)[number];

// Real data (see BUILDLOG.md): genuinely related posts scored 0.59-0.74,
// genuinely unrelated posts (jazz, cooking, astronomy) scored 0.43-0.47.
// 0.52 sits comfortably in the gap between those two clusters.
const MIN_CATEGORY_CONFIDENCE = 0.52;

const ANCHOR_PHRASES: Record<Category, string> = {
  fox: "a red fox",
  wolf: "a gray wolf",
  dog: "a dog",
  bear: "a bear",
};

let anchorCache: Record<Category, number[]> | null = null;

async function getAnchors(): Promise<Record<Category, number[]>> {
  if (anchorCache) return anchorCache;

  const entries = await Promise.all(
    CATEGORIES.map(
      async (category) =>
        [category, await embedText(ANCHOR_PHRASES[category])] as const,
    ),
  );
  anchorCache = Object.fromEntries(entries) as Record<Category, number[]>;
  return anchorCache;
}

/**
 * Posts have no explicit category field — just title + body text. This
 * infers what the post is "about" by comparing its own embedding
 * against one tiny reference embedding per category, reusing the
 * embedding we already computed rather than making another AI call.
 *
 * Returns null when the post isn't genuinely close to any of the 4
 * known categories — e.g. a post about jazz or cooking shouldn't be
 * force-labeled as "the closest of 4 wrong options."
 */
export async function inferExpectedCategory(
  postEmbedding: number[],
): Promise<Category | null> {
  const anchors = await getAnchors();

  let bestCategory: Category = CATEGORIES[0];
  let bestScore = -Infinity;

  for (const category of CATEGORIES) {
    const score = cosineSimilarity(postEmbedding, anchors[category]);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  if (bestScore < MIN_CATEGORY_CONFIDENCE) {
    return null;
  }

  return bestCategory;
}
