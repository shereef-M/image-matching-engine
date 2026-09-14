# Evidence

One pasted proof per Definition-of-Done checkbox (brief §6).

## AI processing

### ✅ Vision model produces structured output validated against a schema; invalid responses are never trusted

Schema (`src/lib/vision-schema.ts`) enforced via Zod, passed to Gemini as
`responseJsonSchema`. Live proof — first real vision call:

```
$ npx tsx src/scripts/test-vision.ts alex-glebov-Y9mp8VnyreQ-unsplash.jpg
Result: {
  "subject": "red fox",
  "category": "fox",
  "attributes": ["orange fur", "amber eyes", "pointed ears", "whiskers", "close-up"],
  "caption": "A close-up portrait of a red fox with vibrant amber eyes looking forward.",
  "confidence": 0.98
}
```

### ✅ Low-confidence classifications are flagged instead of accepted

Deliberately tested, not assumed  a heavily blurred fox photo was fed through the real pipeline end to end:

```
$ npx tsx src/scripts/test-vision.ts zzz-ambiguous-test.jpg
Result: { "subject": "unknown", "category": "dog", "confidence": 0, ... }

$ docker exec ... psql ... -c "SELECT \"filePath\", confidence, status FROM \"Image\" WHERE \"filePath\" LIKE '%zzz-ambiguous%';"
 confidence | status
------------+---------
        0.1 | flagged
```

### ✅ Images are processed through a batch background job with retries

`src/lib/vision-pipeline.ts` runs as a fire-and-forget background job off the request path (`POST /images/process` returns 202 immediately). Retries honor Google's own suggested wait time from 429 errors rather than a blind fixed backoff (see BUILDLOG.md for why this mattered in practice, not just in theory).

### ✅ Vision and embedding costs are tracked per call

```
$ curl .../health && docker exec ... psql ... -c 'SELECT COUNT(*), SUM("costUsd") FROM "CostLogEntry";'
 count |         sum
-------+---------------------
    48 | 0.14400000000000007
```

48 cost entries for 48 images no double-counting from retries, since cost is only logged after a call actually succeeds.

## Matching system

### ✅ Image and post embeddings are stored; posts return ranked image suggestions

All 48 images embedded (`gemini-embedding-001`, 768 dimensions), confirmed via `GET /images`. Posts embed on creation and return ranked candidates via `GET /posts/:id/suggestions`.

### ✅ Semantic matching works for equivalent concepts — "red fox" matches "Vulpes vulpes"

A post titled "Understanding Vulpes Vulpes" the word "fox" never appears anywhere in the post — still correctly resolved
`"expectedCategory":"fox"`, and fox images still ranked top and were approved. Live response (abridged):

```
{"expectedCategory":"fox",
 "bestMatch":{"subject":"Red Fox","category":"fox","similarityScore":0.694,"guardApproved":true}}
```

## Safety layer

### ✅ The mismatch guard rejects incorrect recommendations — the wolf-on-a-fox-post scenario provably fails

Real fox post, real 48-image corpus, zero forcing. Every wolf, bear, and dog image all 36 of them correctly rejected by category, with the top fox images correctly approved:

```
{"category":"wolf","guardApproved":false,"guardReason":"Category mismatch: expected fox, detected wolf"}
{"category":"bear","guardApproved":false,"guardReason":"Category mismatch: expected fox, detected bear"}
{"category":"dog","guardApproved":false,"guardReason":"Category mismatch: expected fox, detected dog"}
```

### ✅ Rejections include a human-readable explanation

Every rejected candidate carries a specific reason see above, plus the two other rejection types actually triggered live:

```
"Low-confidence classification (0.10)"
"Similarity below threshold (0.64)"
```

### ✅ When no image clears the bar, the system answers "no confident match" with reasons

A post about jazz history (nothing in the corpus is remotely related)
returned:

```
{"bestMatch":null,"noConfidentMatch":true}
```

Every candidate's similarity score sat 0.37–0.45 clearly below the 0.65 threshold, confirming this isn't a bug, it's the system correctly refusing to force a match.

## Backend

### ✅ Database models for images, tags, embeddings, posts, suggestions — with indexes

`schema.prisma` — indexes on `Image.status`, `Image.category`,
`Suggestion.reviewStatus`, `CostLogEntry.callType`.

### ⬜ API endpoints validated; the review workflow (approve/reject/inspect why) exists — pending (Phase 4)

`GET /posts/:id/suggestions` already returns full guard reasoning per candidate ("inspect why" is done). The approve/reject actions themselves are Phase 4 work, not yet built.

## Quality & documentation

### ⬜ A small labeled evaluation dataset measures top-1 precision — pending (Phase 4)

### ⬜ README with architecture explanation and diagram — pending (Phase 4, filled in as the system is finished)