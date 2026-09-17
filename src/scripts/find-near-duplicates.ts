import "dotenv/config";
import { prisma } from "../lib/prisma";
import { cosineSimilarity } from "../lib/similarity";

// Two DIFFERENT photos of the same fox would still score high (same
// category, similar description) — this threshold is deliberately much
// higher than the matching engine's own 0.55, since we're looking for
// near-identical images, not just "same category."
const NEAR_DUPLICATE_THRESHOLD = 0.95;

async function main() {
  const images = await prisma.image.findMany({
    where: { status: { in: ["tagged", "flagged"] } },
  });
  const embedded = images.filter((img) => img.embedding.length > 0);

  const pairs: { a: string; b: string; score: number }[] = [];

  for (let i = 0; i < embedded.length; i++) {
    for (let j = i + 1; j < embedded.length; j++) {
      const score = cosineSimilarity(
        embedded[i].embedding,
        embedded[j].embedding,
      );
      if (score >= NEAR_DUPLICATE_THRESHOLD) {
        pairs.push({ a: embedded[i].filePath, b: embedded[j].filePath, score });
      }
    }
  }

  console.log(
    `Checked ${embedded.length} images (${(embedded.length * (embedded.length - 1)) / 2} pairs).`,
  );
  if (pairs.length === 0) {
    console.log(
      `No near-duplicates found above the ${NEAR_DUPLICATE_THRESHOLD} threshold.`,
    );
  } else {
    console.log(`Found ${pairs.length} likely near-duplicate pair(s):`);
    for (const p of pairs) {
      console.log(
        `  ${(p.score * 100).toFixed(1)}% — ${p.a}\n              vs ${p.b}`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Near-duplicate check failed:", err);
    process.exit(1);
  });
