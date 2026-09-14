import "dotenv/config";
import { embedText } from "../lib/gemini";

async function main() {
  const text = process.argv[2] ?? "A close-up portrait of a red fox";
  console.log(`Embedding: "${text}"`);
  const vector = await embedText(text);
  console.log(`Received a vector of length: ${vector.length}`);
  console.log(`First 5 values: ${vector.slice(0, 5).join(", ")}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
