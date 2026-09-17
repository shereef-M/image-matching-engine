import { prisma } from "./prisma";
import { cosineSimilarity } from "./similarity";
import { evaluateGuard } from "./mismatch-guard";
import { inferExpectedCategory } from "./category-anchors";

export type SuggestionCandidate = {
  imageId: string;
  filePath: string;
  subject: string | null;
  category: string | null;
  similarityScore: number;
  guardApproved: boolean;
  guardReason: string;
};

export type PostSuggestions = {
  postId: string;
  expectedCategory: string | null;
  bestMatch: SuggestionCandidate | null;
  candidates: SuggestionCandidate[];
  noConfidentMatch: boolean;
};

export async function getSuggestionsForPost(
  postId: string,
): Promise<PostSuggestions> {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new Error(`Post ${postId} not found`);
  }
  if (post.embedding.length === 0) {
    throw new Error(`Post ${postId} has no embedding yet`);
  }

  const expectedCategory = await inferExpectedCategory(post.embedding);

  if (expectedCategory === null) {
    // The post isn't genuinely close to any of the 4 known categories —
    // don't force a match against "the closest of 4 wrong options."
    return {
      postId,
      expectedCategory: null,
      bestMatch: null,
      candidates: [],
      noConfidentMatch: true,
    };
  }

  const allEligible = await prisma.image.findMany({
    where: { status: { in: ["tagged", "flagged"] } },
  });
  const embedded = allEligible.filter((img) => img.embedding.length > 0);

  const candidates: SuggestionCandidate[] = embedded.map((image) => {
    const similarityScore = cosineSimilarity(post.embedding, image.embedding);
    const guard = evaluateGuard({
      imageConfidence: image.confidence ?? 0,
      imageCategory: image.category ?? "",
      expectedCategory,
      similarityScore,
    });
    return {
      imageId: image.id,
      filePath: image.filePath,
      subject: image.subject,
      category: image.category,
      similarityScore,
      guardApproved: guard.approved,
      guardReason: guard.reason,
    };
  });

  candidates.sort((a, b) => b.similarityScore - a.similarityScore);

  // Persist every candidate as a Suggestion row — this is what the
  // review API (approve/reject) operates on.
  await Promise.all(
    candidates.map((c) =>
      prisma.suggestion.upsert({
        where: { postId_imageId: { postId, imageId: c.imageId } },
        create: {
          postId,
          imageId: c.imageId,
          similarityScore: c.similarityScore,
          guardApproved: c.guardApproved,
          guardReason: c.guardReason,
        },
        update: {
          similarityScore: c.similarityScore,
          guardApproved: c.guardApproved,
          guardReason: c.guardReason,
        },
      }),
    ),
  );

  const bestMatch = candidates.find((c) => c.guardApproved) ?? null;

  return {
    postId,
    expectedCategory,
    bestMatch,
    candidates,
    noConfidentMatch: bestMatch === null,
  };
}
