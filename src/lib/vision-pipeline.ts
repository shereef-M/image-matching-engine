import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "./prisma";
import {
  describeImage,
  extractRetryDelayMs,
  ESTIMATED_VISION_COST_USD,
} from "./gemini";
import { logCost, wouldExceedBudget } from "./cost-tracker";
import type { Image } from "@prisma/client";

const MAX_RETRIES = 3;
const CONFIDENCE_THRESHOLD = 0.6;
const MAX_RETRY_WAIT_MS = 60_000; // cap so one rate-limited image can't stall the whole batch for too long

async function processOneImage(
  image: Pick<Image, "id" | "filePath">,
): Promise<void> {
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      const tags = await describeImage(image.filePath);
      await logCost("vision", image.id, ESTIMATED_VISION_COST_USD);

      const status =
        tags.confidence < CONFIDENCE_THRESHOLD ? "flagged" : "tagged";
      await prisma.image.update({
        where: { id: image.id },
        data: {
          subject: tags.subject,
          category: tags.category,
          attributes: tags.attributes,
          caption: tags.caption,
          confidence: tags.confidence,
          status,
        },
      });
      return;
    } catch (err) {
      if (attempt > MAX_RETRIES) {
        await prisma.image.update({
          where: { id: image.id },
          data: { status: "failed" },
        });
        console.error(
          `Image ${image.id} failed after ${MAX_RETRIES} retries:`,
          err instanceof Error ? err.message : err,
        );
        return;
      }
      // Prefer Google's own suggested wait time (accounts for per-minute
      // quota resets that can take longer than a short fixed backoff) —
      // fall back to exponential backoff only if it didn't give one.
      const suggestedDelay = extractRetryDelayMs(err);
      const waitMs = Math.min(
        suggestedDelay ?? 2 ** attempt * 500,
        MAX_RETRY_WAIT_MS,
      );
      await sleep(waitMs);
    }
  }
}

export type VisionBatchResult = {
  processed: number;
  deferred: number;
};

/**
 * Processes every pending image. Before each call, checks whether it
 * would push the running cost total over the configured budget — if so,
 * that image (and everything still pending after it) is marked
 * "deferred" and the batch stops there, rather than continuing past the
 * cap or crashing partway through.
 */
export async function runVisionBatch(): Promise<VisionBatchResult> {
  const pending = await prisma.image.findMany({ where: { status: "pending" } });

  let processed = 0;
  let deferred = 0;

  for (const image of pending) {
    if (await wouldExceedBudget(ESTIMATED_VISION_COST_USD)) {
      await prisma.image.update({
        where: { id: image.id },
        data: { status: "deferred" },
      });
      deferred++;
      continue;
    }

    await processOneImage(image);
    processed++;
  }

  return { processed, deferred };
}
