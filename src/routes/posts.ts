import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { embedText, ESTIMATED_EMBEDDING_COST_USD } from "../lib/gemini";
import { getSuggestionsForPost } from "../lib/matching-service";
import { logCost } from "../lib/cost-tracker";

export const postsRouter = Router();

const createPostSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1),
});

postsRouter.post("/posts", async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { title, body } = parsed.data;

  try {
    const embedding = await embedText(`${title}. ${body}`);
    const post = await prisma.post.create({ data: { title, body, embedding } });
    await logCost("embedding", post.id, ESTIMATED_EMBEDDING_COST_USD);
    res.status(201).json(post);
  } catch (err) {
    res.status(502).json({
      error: "Failed to embed post content",
      message: err instanceof Error ? err.message : "unknown error",
    });
  }
});

postsRouter.get("/posts/:id/suggestions", async (req, res) => {
  try {
    const result = await getSuggestionsForPost(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(404).json({
      error: err instanceof Error ? err.message : "not found",
    });
  }
});
