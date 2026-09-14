import { Router } from "express";
import { prisma } from "../lib/prisma";
import { runVisionBatch } from "../lib/vision-pipeline";
import { runEmbeddingBatch } from "../lib/embedding-pipeline";

export const imagesRouter = Router();

imagesRouter.post("/images/process", (_req, res) => {
  // Fire-and-forget — this is the "background job, off the request path"
  // pattern. The response returns immediately; the batch keeps running.
  runVisionBatch()
    .then((result) => console.log("Vision batch complete:", result))
    .catch((err) => console.error("Vision batch failed:", err));

  res.status(202).json({ message: "Batch processing started" });
});

imagesRouter.post("/images/embed", (_req, res) => {
  runEmbeddingBatch()
    .then((result) => console.log("Embedding batch complete:", result))
    .catch((err) => console.error("Embedding batch failed:", err));

  res.status(202).json({ message: "Embedding batch started" });
});

imagesRouter.get("/images", async (_req, res) => {
  const images = await prisma.image.findMany({ orderBy: { createdAt: "asc" } });
  res.json(images);
});
