import { Router } from "express";
import { prisma } from "../lib/prisma";

export const suggestionsRouter = Router();

suggestionsRouter.get("/suggestions/:id", async (req, res) => {
  const suggestion = await prisma.suggestion.findUnique({
    where: { id: req.params.id },
  });
  if (!suggestion) {
    return res.status(404).json({ error: "Suggestion not found" });
  }
  res.json(suggestion);
});

suggestionsRouter.post("/suggestions/:id/approve", async (req, res) => {
  try {
    const suggestion = await prisma.suggestion.update({
      where: { id: req.params.id },
      data: { reviewStatus: "approved" },
    });
    res.json(suggestion);
  } catch {
    res.status(404).json({ error: "Suggestion not found" });
  }
});

suggestionsRouter.post("/suggestions/:id/reject", async (req, res) => {
  try {
    const suggestion = await prisma.suggestion.update({
      where: { id: req.params.id },
      data: { reviewStatus: "rejected" },
    });
    res.json(suggestion);
  } catch {
    res.status(404).json({ error: "Suggestion not found" });
  }
});
