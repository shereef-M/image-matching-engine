import "dotenv/config";
import { embedText } from "../lib/gemini";
import { cosineSimilarity } from "../lib/similarity";

const CATEGORIES = ["fox", "wolf", "dog", "bear"] as const;
const ANCHOR_PHRASES: Record<string, string> = {
  fox: "a red fox",
  wolf: "a gray wolf",
  dog: "a dog",
  bear: "a bear",
};

const TEST_POSTS = [
  {
    label: "fox post (should be HIGH)",
    text: "The Behavior of Red Foxes. Red foxes are cunning, adaptable predators found across diverse habitats.",
  },
  {
    label: "bear post (should be HIGH)",
    text: "Grizzly Bears and Hibernation Patterns. During winter months, these massive omnivores enter a state of reduced metabolic activity.",
  },
  {
    label: "jazz post (should be LOW)",
    text: "A History of Jazz Music. Jazz emerged in New Orleans in the early 20th century, blending blues and ragtime.",
  },
  {
    label: "cooking post (should be LOW)",
    text: "Mastering French Sauces. A classic bechamel starts with a roux of butter and flour, whisked into warm milk.",
  },
  {
    label: "astronomy post (should be LOW)",
    text: "The Life Cycle of Stars. Stars form from collapsing clouds of gas and dust, fusing hydrogen into helium over billions of years.",
  },
];

async function main() {
  const anchors: Record<string, number[]> = {};
  for (const category of CATEGORIES) {
    anchors[category] = await embedText(ANCHOR_PHRASES[category]);
  }

  for (const post of TEST_POSTS) {
    const postEmbedding = await embedText(post.text);
    const scores = CATEGORIES.map((c) => ({
      category: c,
      score: cosineSimilarity(postEmbedding, anchors[c]),
    }));
    scores.sort((a, b) => b.score - a.score);
    console.log(`\n${post.label}`);
    for (const s of scores) {
      console.log(`  ${s.category}: ${s.score.toFixed(3)}`);
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
