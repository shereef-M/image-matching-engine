import "dotenv/config";
import { embedText } from "../lib/gemini";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
  const phrases = {
    fox1: "A close-up portrait of a red fox",
    fox2: "A wild fox in the forest",
    wolf: "A gray wolf howling at night",
  };

  const embeddings: Record<string, number[]> = {};
  for (const [key, text] of Object.entries(phrases)) {
    embeddings[key] = await embedText(text);
  }

  console.log(
    "fox1 vs fox2 (should be HIGH):",
    cosineSimilarity(embeddings.fox1, embeddings.fox2).toFixed(4),
  );
  console.log(
    "fox1 vs wolf (should be LOWER):",
    cosineSimilarity(embeddings.fox1, embeddings.wolf).toFixed(4),
  );
  console.log(
    "fox2 vs wolf (should be LOWER):",
    cosineSimilarity(embeddings.fox2, embeddings.wolf).toFixed(4),
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
