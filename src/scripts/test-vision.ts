import "dotenv/config";
import path from "node:path";
import { describeImage } from "../lib/gemini";

// Change this to any real file in your dataset if you want to try another one.
const TEST_IMAGE = path.join(
  process.cwd(),
  "dataset/images/wolf",
  process.argv[2] ?? "",
);

async function main() {
  if (!process.argv[2]) {
    console.error(
      "Usage: npx tsx src/scripts/test-vision.ts <filename-in-dataset/images/fox>",
    );
    console.error(
      "Example: npx tsx src/scripts/test-vision.ts <one-of-your-fox-filenames>.jpg",
    );
    process.exit(1);
  }

  console.log(`Sending ${TEST_IMAGE} to the vision model...`);
  const tags = await describeImage(TEST_IMAGE);
  console.log("Result:", JSON.stringify(tags, null, 2));
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
