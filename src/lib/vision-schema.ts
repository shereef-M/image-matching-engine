import { z } from "zod";

export const visionTagSchema = z.object({
  subject: z.string().min(1),
  category: z.enum(["fox", "wolf", "dog", "bear"]),
  attributes: z.array(z.string()).min(1).max(6),
  caption: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type VisionTags = z.infer<typeof visionTagSchema>;
