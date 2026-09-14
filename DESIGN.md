# Design Doc — Image Matching Engine

## 1. Problem

Given a library of images and a set of blog posts, understand what's actually in each image (not filenames or keywords), and suggest the best-matching image per post based on meaning, not exact word overlap. Critically: refuse to suggest an image when nothing is a confident enough match, with a human-readable explanation either way.

## 2. Non-goal

This is not a general-purpose image search engine or a content management UI. No frontend is built the review workflow (approve/ reject a suggestion, inspect why) is API endpoints plus a simple table, nothing more.

## 3. Data model

Image
id, filePath, subject, category, attributes (string[]), caption
confidence (0-1), embedding (float[])
status: pending | tagged | flagged | failed
createdAt, updatedAt

Post
id, title, body, embedding (float[])
createdAt

Suggestion
id, postId, imageId
similarityScore, guardApproved (bool), guardReason
reviewStatus: pending | approved | rejected
createdAt

CostLogEntry
id, callType: vision | embedding
refId (imageId or postId), costUsd
createdAt


No `pgvector` extension, at ~50 images, plain array columns and
in-process cosine similarity are more than fast enough, and one less
piece of infrastructure to set up.

## 4. API surface

POST /images/process trigger the batch vision-tagging job
GET /images list images with tags/status
GET /posts/:id/suggestions ranked, guard-filtered image suggestions
POST /suggestions/:id/approve
POST /suggestions/:id/reject
GET /eval run the eval script, return top-1 precision
GET /costs cost log + running total vs. budget cap


## 5. Layer sketch

HTTP layer (routes/controllers)
↓
Service layer (vision service, embedding service, matching service,
mismatch guard, cost/budget service)
↓
Background job (batch vision processing — retries + backoff per image,
same pattern as the social publisher's adapter retries)
↓
Data layer (Postgres via Prisma)


## 6. Stack

- Node.js + Express + TypeScript
- PostgreSQL via Prisma (Docker) — no Redis needed this time
- Gemini API free tier (vision + embeddings) via Google AI Studio key
- Zod for schema validation of AI responses
- Vitest for tests

## 7. Vision output schema (Zod)

Every vision model response is validated against this shape before the code trusts any of it. Invalid or missing fields → the image is flagged, never guessed.

```ts
const visionTagSchema = z.object({
  subject: z.string().min(1),
  category: z.enum(["fox", "wolf", "dog", "bear"]),
  attributes: z.array(z.string()).min(1).max(6),
  caption: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
```

## 8. Post category inference

Posts have no explicit category field, they're just title + body text. To compare a candidate image's category against "what the post is about," we embed one tiny reference phrase per category once at startup ("a red fox", "a gray wolf", "a dog", "a bear"), and compare the post's own embedding against each. Whichever reference it's closest to becomes the post's inferred `expectedCategory`. This reuses the embedding we already have to compute — no extra vision or LLM call.

## 9. The mismatch guard — decision rules

Checked in this order; the first failing check determines the rejection reason. All three must pass for a suggestion to be approved.

```ts
const CONFIDENCE_THRESHOLD = 0.6;  // below this, the vision tag itself was already flagged in Phase 2
const SIMILARITY_THRESHOLD = 0.65; // cosine similarity — a placeholder, tuned for real in Phase 4 against the eval set

function evaluateGuard(post, image, similarityScore) {
  if (image.confidence < CONFIDENCE_THRESHOLD) {
    return { approved: false, reason: `Low-confidence classification (${image.confidence})` };
  }
  if (image.category !== post.expectedCategory) {
    return { approved: false, reason: `Category mismatch: expected ${post.expectedCategory}, detected ${image.category}` };
  }
  if (similarityScore < SIMILARITY_THRESHOLD) {
    return { approved: false, reason: `Similarity below threshold (${similarityScore.toFixed(2)})` };
  }
  return { approved: true, reason: "Confident match" };
}
```

Both threshold numbers are explicitly placeholders here Phase 4's job is to tune them against the real labeled eval set and defend the final numbers with an actual precision score, not a feeling.
