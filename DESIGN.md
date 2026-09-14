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
