import "dotenv/config";
import { prisma } from "../lib/prisma";
import { embedText } from "../lib/gemini";
import { getSuggestionsForPost } from "../lib/matching-service";
import { EVAL_SET } from "../lib/eval-set";

async function main() {
  let correct = 0;
  const results: {
    title: string;
    expected: string;
    got: string;
    correct: boolean;
  }[] = [];

  for (const testCase of EVAL_SET) {
    const embedding = await embedText(`${testCase.title}. ${testCase.body}`);
    const post = await prisma.post.create({
      data: { title: testCase.title, body: testCase.body, embedding },
    });

    const result = await getSuggestionsForPost(post.id);
    const gotCategory = result.bestMatch?.category ?? "no-match";
    const isCorrect = gotCategory === testCase.expectedCategory;
    if (isCorrect) correct++;

    results.push({
      title: testCase.title,
      expected: testCase.expectedCategory,
      got: gotCategory,
      correct: isCorrect,
    });

    if (!isCorrect) {
      console.log(`\n--- Diagnosing failure: "${testCase.title}" ---`);
      console.log(
        `  Category inferred for this post: ${result.expectedCategory}`,
      );
      const categoryCorrectlyInferred =
        result.expectedCategory === testCase.expectedCategory;
      console.log(
        `  Category inference itself: ${categoryCorrectlyInferred ? "CORRECT" : "WRONG — this is the real problem"}`,
      );
      const topThree = result.candidates.slice(0, 3);
      for (const c of topThree) {
        console.log(
          `    - ${c.category} (sim ${c.similarityScore.toFixed(2)}, approved=${c.guardApproved}): ${c.guardReason}`,
        );
      }
    }
  }

  console.log("\n--- Eval results ---");
  for (const r of results) {
    console.log(
      `${r.correct ? "✓" : "✗"} "${r.title}" — expected: ${r.expected}, got: ${r.got}`,
    );
  }

  const precision = correct / EVAL_SET.length;
  console.log(
    `\nTop-1 precision: ${correct}/${EVAL_SET.length} = ${(precision * 100).toFixed(1)}%`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Eval run failed:", err);
    process.exit(1);
  });
