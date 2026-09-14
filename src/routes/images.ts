import { Router } from "express";
import { prisma } from "../lib/prisma";
import { runVisionBatch } from "../lib/vision-pipeline";

export const imagesRouter = Router();

imagesRouter.post("/images/process", (_req, res) => {
  // Fire-and-forget — this is the "background job, off the request path"
  // pattern. The response returns immediately; the batch keeps running.
  runVisionBatch()
    .then((result) => console.log("Vision batch complete:", result))
    .catch((err) => console.error("Vision batch failed:", err));

  res.status(202).json({ message: "Batch processing started" });
});

imagesRouter.get("/images", async (_req, res) => {
  const images = await prisma.image.findMany({ orderBy: { createdAt: "asc" } });
  res.json(images);
});
