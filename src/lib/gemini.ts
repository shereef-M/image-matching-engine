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

export const VISION_MODEL = "gemini-3.6-flash";

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
  const mimeType = path.extname(filePath).toLowerCase() === ".png" ? "image/png" : "image/jpeg";

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

// Gemini Flash pricing (per the free-tier-aware cost tracker) — an estimate
// used purely for the budget guard, not a billing-accurate figure.
export const ESTIMATED_VISION_COST_USD = 0.001;