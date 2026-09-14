import { prisma } from "./prisma";
import {
  embedText,
  extractRetryDelayMs,
  ESTIMATED_EMBEDDING_COST_USD,
} from "./gemini";
import { logCost, wouldExceedBudget } from "./cost-tracker";
import { setTimeout as sleep } from "node:timers/promises";
import type { Image } from "@prisma/client";

const MAX_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 60_000;

async function embedOneImage(
  image: Pick<Image, "id" | "caption">,
): Promise<void> {
  if (!image.caption) return; // shouldn't happen for tagged/flagged images, but guard anyway

  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const vector = await embedText(image.caption);
      await logCost("embedding", image.id, ESTIMATED_EMBEDDING_COST_USD);
      await prisma.image.update({
        where: { id: image.id },
        data: { embedding: vector },
      });
      return;
    } catch (err) {
      if (attempt > MAX_RETRIES) {
        console.error(
          `Embedding failed for image ${image.id} after ${MAX_RETRIES} retries:`,
          err instanceof Error ? err.message : err,
        );
        return; // leave embedding empty — it just won't show up in matching yet
      }
      const suggestedDelay = extractRetryDelayMs(err);
      await sleep(
        Math.min(suggestedDelay ?? 2 ** attempt * 500, MAX_RETRY_WAIT_MS),
      );
    }
  }
}

export type EmbeddingBatchResult = { processed: number; deferred: number };

export async function runEmbeddingBatch(): Promise<EmbeddingBatchResult> {
  const candidates = await prisma.image.findMany({
    where: { status: { in: ["tagged", "flagged"] } },
  });
  const needsEmbedding = candidates.filter((img) => img.embedding.length === 0);

  let processed = 0;
  let deferred = 0;

  for (const image of needsEmbedding) {
    if (await wouldExceedBudget(ESTIMATED_EMBEDDING_COST_USD)) {
      deferred++;
      continue;
    }
    await embedOneImage(image);
    processed++;
  }

  return { processed, deferred };
}
