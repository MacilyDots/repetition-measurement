# My repetition guard measured lines, not repetition

**A field report from a single production agent deployment, October 2026.**

This is not a paper. It reports no prevalence, generalizes to no other model or workload, and proposes no mechanism. It is a record of three things that happened when I tried to measure a specific failure mode in an agent I run, and of what I could not find out.

The short version: the guard I had was looking at the wrong granularity, the measurement was sensitive to something that had nothing to do with the model, and hitting the repetition threshold turned out not to mean the request had failed.

---

## 0. Context

The system is a tool-using reasoning agent. In a normal step it writes some reasoning text, then emits a tool call, then reads the result and continues. Occasionally a response would get stuck emitting the same short line — `做。` ("do."), `好。` ("ok.") — over and over, sometimes hundreds of times, before any tool call appeared.

A production guard was already running. It worked like this:

- take the reasoning text
- split on newlines, strip each line
- keep lines of 1–64 characters that contain at least one letter or digit
- count the maximum number of times any one line repeats
- cancel the response if that count reaches 100

That rule fired 16 times across 6 sessions over about ten days. Those cancellations are what made me want to look closer.

Everything below comes from that deployment, one fixed conversation history used to replay requests, and offline analysis of responses that had already been generated. Roughly 4,150 replayed requests across 42 batches, plus 139 scanned session directories. No new model was trained, nothing was served, and the numbers are small.

---

## 1. The guard could not see what it was built to catch

I took 20 responses that I had verified by hand — reading each one — as cases of strong, obvious repetition. All 20 contained text like:

```
做。做。做。做。做。做。做。做。做。做。……
```

all on **one line**.

The guard flagged **zero** of them. The median maximum line count across those 20 responses was **1**. Every line was unique, because the whole runaway passage was one single line.

This is not a bug in the implementation. It is a consequence of the unit of measurement. The rule asks "does any line repeat 100 times". A response that repeats a phrase 400 times on one line has a count of 1 for that line, because there is only one line.

Switching the counting unit to character-level 30-grams made the same 20 responses light up immediately. Same text, same responses, different unit.

**Practical consequence.** If your guard is a line-count rule, then "the guard never fired" is not evidence that repetition did not happen. For a specific and common shape of repetition — the one where the model never emits a newline — the guard is structurally blind, and lowering the threshold from 100 to 50 or 20 does nothing, because the count is 1 regardless of the threshold.

I did not discover this by being clever. I discovered it because someone asked me why a response that was obviously looping had never been caught.

---

## 2. Delete the newlines and the result disappears

The harder thing to accept was the second finding.

I had a batch of 300 responses that had already been generated. Applying the line-level rule to them produced **14 hits out of 300**.

Then I transformed the same 300 responses, without ever calling the model again:

- **Delete all newlines.** The line-level rule now produced **0 hits**. All 14 vanished.
- **Rewrap the text after sentence-ending punctuation** instead of on the model's original line breaks. Now **10 of 300** flipped — most of the previous hits came back, and some new ones appeared.

The character-level 30-gram criterion was much more stable under both transformations.

This is not a finding about the model. The model did not run. The same 300 strings were re-segmented, and their classification changed completely. What changed was not the text's content but where the line boundaries fell.

**Practical consequence.** Any experiment that manipulates text *format* — injecting line-broken lists, merging short lines into paragraphs, normalizing whitespace — and then measures a detector's output, is measuring two things at once unless the detector's terminal criterion is held fixed. If you rewrap an input and compare hit rates, you cannot tell whether the effect came from the model behaving differently or from the detector reading the same behavior differently.

Concretely: I had a real injection experiment whose conditions differed in line structure. After this check, I could no longer treat its hit-rate difference as a model effect, because part of the difference could be produced by the detector alone, with no model in the loop.

I want to be precise about what this is and is not. It does not show the model is insensitive to format. It shows the *detector* is sensitive to format, which is a much weaker and more mundane claim, and one that is easy to verify: generate once, re-segment, compare.

---

## 3. Hitting the repetition threshold is not the same as failing

The guard cancels a response as soon as it counts 100 repeats, which makes it natural to treat "hit" as "failure". That is wrong in a way that matters for anyone building these monitors.

I ran 400 interleaved requests, randomly choosing between two injection conditions each round, and recorded the stop reason for every response that hit the threshold:

| Batch | Hits | ended with `tool_use` | `max_tokens` | `end_turn` |
|---|---:|---:|---:|---:|
| Condition 50-line | 5 | 4 | 0 | 1 |
| Condition 75-line | 17 | 16 | 1 | 0 |
| Same-length, repeated | 16 | 13 | 1 | 2 |
| Same-length, numbered | 5 | 4 | 0 | 1 |

Most responses that crossed the repetition threshold then went on to emit a tool call anyway. Not all of them — one to two per batch ran to the token limit, and a couple ended normally — but the majority recovered on their own.

So "repetition happened" and "the request failed" are two different measurements, and a guard that treats them as one will:
- count recoverable responses as failures, and
- miss the fact that a response which eventually calls a tool may still have burned a large number of tokens before doing so.

The second point I did not quantify, and I should have. The cost of a response that repeats 300 times and then recovers is real but it is a cost, not a failure, and it needs a separate instrument.

---

## 4. Three features I built, and what they cannot do

I wanted a way to describe repetition shapes rather than just count a line. Three reachable candidates:

| feature | what it counts | known blind spot |
|---|---|---|
| `exact_run` | longest consecutive run of identical segments after whitespace/punctuation normalization | a substantively different sentence interrups the run |
| `template_run` | longest consecutive run of identical skeletons after replacing number strings with placeholders | legal numbered lists, consecutive assignments, and same-shape table rows all match |
| `alternating_run` | consecutive complete repeat units with period 2 or 3 | periods of 4 or more are out of scope |

I wrote 28 constructed test cases with expected outputs before running them, then compared against the implementation. The first pass passed 19 of 28. After fixing three categories of problem — an implementation bug that returned empty below the marking threshold, an expectation error that failed to distinguish spaces from sentence-ending separators, and three cases that were not actually consecutive same-skeleton text — the third pass passed **28 of 28**.

That number means exactly one thing: on the cases I wrote, the implementation matches the specification I also wrote. The cases were part of the revision loop. It is a development-set consistency result, not a detection accuracy result, and it is not independent.

The more useful result was a failure. Three **legitimate** texts — a numbered list, a block of consecutive variable assignments, and a table whose rows have identical structure — all produced `template_run = 5`. They are legal text. The feature reporting "a skeleton repeated five times" is accurate. The problem is downstream: if you use the feature's output as a failure label, you get false positives on perfectly normal output.

So the three features support one narrow claim: **repetition form can be measured recomputably**. They do not support "this form is anomalous". That judgement has to happen somewhere else, and I did not build it.

---

## 5. What I could not do

I want to be explicit, because in a field report the negative results are the part that saves other people time.

**I never caught the failure at the point where it happened.** I set up three-layer recording — raw upstream SSE stream (L1), the adapter's reconstructed text and tool blocks (L2), and the session event stream (L3) — so that a single real occurrence would tell me whether the repetition originated upstream or was introduced locally. It never fired on a real repetition event. The only successful alignment is one normal request (1,147 characters of reasoning, a `js` code fence appearing twice, one tool block in both L1 and L3). **A case study with no case.** This was not a coding problem; it requires a genuine event to occur while all three layers are recording, and the probability of that in a short window is not under my control. Waiting was not a plan, so I stopped.

**A cross-session comparison I reported turned out to be unusable.** I had two conversations where I injected the same 200 lines and got 10/100 versus 0/100. I read that as evidence that input specificity mattered. A later audit found the two conversations differ in the history they were built from — different turn and step, different system prompt length (15,881 vs 13,976 characters), different tool count (60 vs 67), different total token size (≈28.3k vs ≈34.8k). The injection was the same; nothing else was. That comparison cannot separate "the injected content" from "the context it was injected into", so it is not evidence of anything. I am recording it as withdrawn rather than quietly dropping it.

**The human agreement numbers do not support what I wanted them to.** In one batch of 8 items, observed and chance agreement were both 75.0% (Cohen's κ = 0) — one annotator marked all 8 as looping, so the agreement carries no information beyond that annotator's bias. In a second batch of 16, both annotators agreed on every single item (16/16, κ = 1.00), which sounds excellent until you notice there was exactly **one** jointly-negative item. With one negative example you cannot evaluate the ability to tell looping from productive deliberation. The sample pool came from flagged and near-flagged responses and had almost no "actually making progress" controls, and no amount of additional annotators fixes that.

**The precursor signal is an artifact of where I put the window.** All the precursor analysis was built around "the first occurrence of the response's most frequent character 30-gram". That position is frequently already inside the runaway loop, so the measured difference is a difference *inside* repetition, not a warning sign *before* it. I am not claiming early-warning capability.

**Neither of the two empirical findings can be recomputed from scratch by anyone else.** The raw SSE responses (about 482 MB) and the 300 upstream logs for the format experiment contain project text and are not in this repository. The scripts are here and they fall back to checking the de-identified summary, but the actual re-computation requires material nobody else has. Stating this is more useful than hiding it: the two things I most want you to believe are the two I can least demonstrate.

---

## 6. If you are building one of these

Four things I would do differently, in order of how much time they would have saved me.

**1. Never use a single-granularity repetition rule as a guard.** Check at least two units — line and character n-gram — and report them separately. A line rule and a 30-gram rule disagree on real data by a wide margin (§1), and the disagreement is structural, not statistical.

**2. Freeze the detector before running any format-manipulating experiment.** Generate once, then evaluate under a fixed terminal criterion. If you are comparing conditions whose text is segmented differently, re-segment both at analysis time so the detector sees the same shape.

**3. Log `stop_reason` per response and treat "hit" and "failed" as separate columns.** In my data most hits recovered; treating them as failures inflates the failure rate by roughly an order of magnitude.

**4. Budget for the event you actually need to observe.** If your measurement requires catching a rare live event with multi-layer instrumentation, that is not a feature you can schedule — it is a waiting problem with no deadline. Either build an injectable reproduction of the event first, or accept that the mechanism question stays open.

---

## 7. What is in this repository

| Path | What it is |
|---|---|
| `code/` | the three features and the 28 spec cases, with their run logs |
| `tools/repro/` | every number in this report, with `manifest.json` mapping each claim to its script, inputs, and expected output |
| `labels/` | de-identified annotation data; batch B labels are **reconstructed** from conversation records, not original submissions |
| `governance/` | a release incident record and the publish rules I now use |

To check the numbers:

```bash
cd code && node spec-check.mjs              # expect 28/28
cd tools/repro && python agreement.py --expect
cd tools/repro && node batch-stats.mjs
```

Requires Node 18+ and Python 3.10+, standard library only. `verify-strong.mjs` and the format-flip numbers need raw material that is not published (see §5, last point).

---

## 8. Provenance

The analysis, the code, the drafting, and the model-assisted annotation in this work were done with substantial AI assistance. Where human and model annotation appear in the same table, they are labelled separately. This participation does not constitute independent validation. The responsibility for the data, the interpretation, and the citations is mine.

If you find an error, open an issue. I would rather know.
