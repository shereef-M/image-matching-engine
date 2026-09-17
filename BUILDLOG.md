# Build log

Honest log of where AI (Claude) helped, where it was wrong, and what got changed. Written as we go, not reconstructed at the end.

## Phase 1 — Design and dataset

AI drafted DESIGN.md, including the exact vision-output schema and the mismatch guard's decision rules (confidence → category → similarity, in that order) before any code was written. Also caught and fixed a real problem in the gathered dataset: the initial image commit was 146MB (full-resolution Unsplash downloads), which the brief explicitly warns against. Resized to ~800px and amended the commit before it became permanent history, rather than leaving it and adding more commits on top.

## Phase 2 — Vision pipeline

This phase surfaced three real, live problems that no amount of upfront planning would have caught all found by actually running the system against the real API, not by code review:

1. `gemini-2.5-flash` returned a live 404: "no longer available to new
   users." AI switched to `gemini-3.6-flash` based on Google's own
   suggested replacement in the error message.
2. `gemini-3.6-flash`'s free tier turned out to be capped at 20 requests
   **per day** — far too low for a 48-image batch. Switched to
   `gemini-flash-lite-latest`, verified as a real, current Google alias
   (not guessed) and empirically confirmed to have a workable daily
   quota by actually running the batch.
3. Even Flash-Lite hit a **per-minute** rate limit partway through the
   batch (a different quota than the daily one). The original retry
   logic used a short fixed backoff that didn't wait long enough for a
   per-minute quota to reset. Fixed by parsing Google's own suggested
   `retryDelay` out of the 429 error body and actually waiting that
   long — verified by testing the parser against the exact real error
   message from the terminal, not just against a synthetic one.

Also worth naming honestly: I initially suggested "eyeballing" whether two embedding vectors looked similar by comparing 5 raw numbers out of 768 that's not a real test. Caught this and built an actual cosine similarity script instead, which is what produced the real evidence below.

Result, fully verified live: all 48 images tagged, zero failures, 48 cost log entries (no double-counting from retries), ~$0.144 total.

## Phase 3 — Matching engine and mismatch guard

The similarity/guard logic (`similarity.ts`, `mismatch-guard.ts`) is pure, dependency-free code — fully unit tested (11 tests) without needing any live API call, including the exact fox/wolf scenario from the brief as an explicit test case.

One real design validation came from live data, not assumption: a direct cosine-similarity test showed fox-vs-fox at 0.76 but fox-vs-wolf still at 0.62–0.68 closer than expected. This confirmed the guard's design decision (category match as a hard gate, not just a similarity threshold) actually matters in practice similarity alone genuinely isn't enough to reliably separate closely related animals.

The four core acceptance probes were tested deliberately, not assumed working from the code:

- Fox post → fox images rank first, all approved (Probe 2)
- Wolf/bear/dog images on a fox post → all rejected by category,
  zero false positives across 36 wrong-category candidates (Probe 3)
- Jazz post (nothing relevant in the corpus) → correctly refused with
  `noConfidentMatch: true`, not a forced guess (Probe 4)
- Low-confidence flagging (Probe 1) had never actually fired on the
  real 48-image corpus (all came back high-confidence) — rather than
  leave this unproven, deliberately fed the model a heavily blurred
  test image through the real pipeline and confirmed it landed as
  `status: "flagged"` in the database, not silently accepted.

Also verified: semantic matching genuinely works on meaning, not keywords — a post titled "Understanding Vulpes Vulpes" (the word "fox" never appears) still correctly inferred `expectedCategory: "fox"` and still ranked fox images first.

## Phase 4 — Review API, eval set, and a real tuning decision

The review API (approve/reject) was quick mostly wiring, since the guard reasoning was already being persisted since Phase 3.

The eval set is the phase worth describing honestly. First real run came back 7/12 (58.3%), and the easy move would have been to just report that number. Instead, the eval script was extended to print _why_ each failure happened was the category itself wrong, or was similarity too low despite a correct category? Every single failure turned out to be the latter: correct category, similarity just under the 0.65 placeholder threshold.

That's not five unrelated bugs it's one pattern. Fox/wolf test posts happened to use vivid, descriptive language ("cunning," "keen senses," "apex predator") that sits close to how the vision model captioned those photos. Dog/bear posts leaned more encyclopedic ("choosing a breed," "hibernation patterns"), landing further away in embedding space despite being equally correct matches. This also explained a genuinely surprising result on the way there: "Grizzly Bears and Hibernation Patterns" (which literally names the animal) failed, while "Encounters with Large Forest Mammals" (no animal name at all, but far more descriptive) succeeded vividness of language mattered more than literally naming the subject.

`SIMILARITY_THRESHOLD` had been explicitly marked a placeholder since Phase 1, meant to be tuned against real data rather than guessed this was that moment. Lowered it to 0.55, which the diagnostic data directly justified (it cleared every failing case's actual top candidate). Because the guard checks category before similarity, this could not introduce new false positives it can only recover correct-category matches that were being wrongly rejected. Result: 12/12 (100%).

Worth being honest about scope: this is a strong result on 12 self-authored examples, not a claim that generalizes to arbitrary unseen posts. The eval set exists to make a real, data-driven tuning decision possible not to prove the system is perfect.

## Stretch goals — near-duplicate detection and the budget guard demo

Near-duplicate detection was quick pure math over embeddings already computed for the matching engine, no new API cost. Result was a clean zero (no near-duplicates in this 48-image set), which is a fine, honest outcome the check is real even though this particular dataset had nothing to catch.

The budget guard demo took real debugging to actually get right, and that process is worth logging honestly rather than skipping to the clean result. Setting `COST_BUDGET_USD` in `.env` and expecting it to take effect didn't work on the first several attempts the batch kept processing normally instead of deferring. Root causes checked and ruled out one at a time: a shell environment variable silently overriding `.env` (checked via `echo $COST_BUDGET_USD` empty, not the cause), then confirmed via direct diagnostic logging inside `wouldExceedBudget` itself. The actual cause turned out to be simpler than any of those: the dev server process running in a separate terminal tab hadn't actually been restarted after the `.env` edit
`dotenv` only reads environment variables once, at process startup, so a running process keeps its original values until it's stopped and started again. Once confirmed restarted, the guard worked exactly as designed on the first real attempt: all 12 reset images correctly marked `deferred`, zero additional API calls made, zero crash.

Post-completion — category confidence floor

Same methodology as the similarity threshold tuning: gathered real data first (5 test posts, 2 genuinely related to known categories, 3 genuinely not), found a real gap in the numbers, then picked a threshold that sits inside it not a guess.

Along the way, adding temporary diagnostic logging to posts.ts introduced a real bug: a duplicated try { line broke the file's brace matching entirely, crashing the dev server silently. Every POST /posts request from that point hung forever with no response not because of the AI call, but because the process had actually stopped. Diagnosed by checking the simplest possible thing first (GET /health, which still worked) to confirm the issue was specific to one route rather than the whole server, then inspecting the file directly rather than continuing to guess. Fixing the syntax error also surfaced a second, unrelated real bug: the success path was missing res.status(201).json(post) entirely even once the server was healthy, a successful post creation would have hung forever waiting for a response that was never sent. Both fixed together.
