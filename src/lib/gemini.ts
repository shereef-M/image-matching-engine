import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { visionTagSchema, type VisionTags } from "./vision-schema";

// @google/genai is a pure-ESM package, but this project uses CommonJS —
// a dynamic import() bridges that cleanly without converting the whole
// project to ESM.
let clientPromise: ReturnType<typeof createClient> | null = null;

async function createClient() {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = createClient();
  }
  return clientPromise;
}

export const VISION_MODEL = "gemini-flash-lite-latest";
export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Sends one image to the vision model and returns schema-validated tags.
 * Throws if the model's response doesn't match the schema — the caller
 * decides what to do with an invalid response (retry, flag, etc.), this
 * function never silently accepts something malformed.
 */
export async function describeImage(filePath: string): Promise<VisionTags> {
  const ai = await getClient();

  const imageBuffer = await fs.readFile(filePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType =
    path.extname(filePath).toLowerCase() === ".png"
      ? "image/png"
      : "image/jpeg";

  const response = await ai.models.generateContent({
    model: VISION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Identify the main animal subject in this image. Respond only " +
              "with the requested structured fields — no extra commentary.",
          },
          { inlineData: { mimeType, data: base64Image } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(visionTagSchema),
    },
  });

  const rawText = response.text;
  if (!rawText) {
    throw new Error("Vision model returned an empty response");
  }

  const parsed = JSON.parse(rawText);
  return visionTagSchema.parse(parsed);
}

// Gemini Flash pricing (per the free-tier-aware cost tracker) — rough
// per-call estimates used purely for the budget guard, not billing-exact.

/**
 * Google's 429 errors include a suggested wait time in their own error
 * body (RetryInfo.retryDelay, e.g. "22s"). Extracting and honoring this
 * is what actually makes rate-limit retries succeed — a short fixed
 * backoff doesn't account for per-minute quota resets that can take
 * longer than a few seconds to clear.
 */
export function extractRetryDelayMs(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(message);
    const details = parsed?.error?.details;
    if (!Array.isArray(details)) return null;

    const retryInfo = details.find(
      (d: any) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
    );
    const retryDelay: string | undefined = retryInfo?.retryDelay;
    if (!retryDelay) return null;

    const seconds = parseFloat(retryDelay.replace("s", ""));
    if (Number.isNaN(seconds)) return null;
    return Math.ceil(seconds * 1000);
  } catch {
    return null;
  }
}

export const ESTIMATED_VISION_COST_USD = 0.003;
export const ESTIMATED_EMBEDDING_COST_USD = 0.0001;

/**
 * Embeds a piece of text (an image caption or a blog post's content) into
 * the shared semantic space used for matching. Same model for both sides
 * so they're directly comparable.
 */
export async function embedText(text: string): Promise<number[]> {
  const ai = await getClient();

  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });

  const embedding = result.embeddings?.[0]?.values;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error(
      `Unexpected embedding response shape: ${JSON.stringify(result)}`,
    );
  }
  return embedding;
}
