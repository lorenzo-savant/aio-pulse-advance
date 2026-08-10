# TODOS

Deferred work with enough context to pick up cold. Each entry records why it was
deferred, not just what it is.

Sources: `RAPPORTO-ANALISI-SEZIONI-2026-08-07.md` (diagnostic, file:line evidence)
and issue #25 (refactor plan + engineering review). Both are dated snapshots;
this file is the living list.

---

## 1. Unreachable dashboard pages — PARTLY DONE 2026-08-07

Four complete, working pages had zero inbound links from anywhere. Every one of
them called endpoints that exist and return data; none was broken. Two are
resolved, two remain open because they turn on product decisions.

**Resolved:**

- `/dashboard/overview` (683 lines) — **connected** as "Brand Overview" under
  Insights. It is the only surface in the product showing Google Search Console
  data, and two of its three GSC panels — `CannibalizationPanel` and
  `StrikingDistancePanel` — exist nowhere else, so deleting it would have thrown
  away working analysis nobody had ever seen. Verified it duplicates neither
  `/dashboard` (which aggregates insight surfaces) nor `/dashboard/brands/[id]`
  (brand configuration and team): the three share no data sources at all.
- `/dashboard/glossary` (135 lines) — **deleted.** The Documentation page,
  already in the sidebar, carries a glossary section with more terms. See entry
  11 for the drift this exposed.

**Still open — `/dashboard/cost-monitor` (513 lines).**

The only surface in the product showing API cost data. Connecting it
contradicts a decision already taken and written down: `/dashboard/api-costs`
is a deliberate placeholder stating "this deployment runs internally in
unlimited mode, so credit-based cost tracking is not exposed here".

That decision is worth re-examining rather than assumed. On 2026-08-07 the
first operational question asked of this codebase was how much credit remained
on the AI provider keys — which the product could not answer, and which had to
be established by calling the providers by hand.

Related: entry 2 (three parallel cost subsystems) should be settled at the same
time, because connecting this page decides which of the three survives.

**Still open — `/dashboard/analytics` (505 lines). Not actually an orphan.**

Correcting the original diagnostic, which called this page unreachable: it IS
linked, from the **public landing page**. `HomeContent.tsx:64` lists it as the
"AVI" feature card, rendered at line 145. Three of the four feature cards point
at pages that are in the sidebar; this is the one that is not.

So a prospect clicks the AVI feature, lands on Analytics, signs up — and can
never navigate back to it, because the authenticated app has no link. That is a
worse problem than an unreachable page, and it is not fixed by deleting the
page: deleting it breaks a link the marketing site is actively advertising.

The overlap with `/dashboard/snapshots`, which IS in the sidebar:

| analytics                     | snapshots (linked)        |
| ----------------------------- | ------------------------- |
| Citation Trend                | Citation Rate Trend       |
| Competitor Comparison         | Competitor Citation Rates |
| Avg Citation / Avg Visibility | —                         |
| Change vs previous period     | Snapshot History          |

Snapshots already covers both charts. Analytics adds period-over-period
comparison and averages.

Three ways out, in preference order:

1. Fold the period comparison and averages into Snapshots, then point the
   landing page's AVI card at Snapshots and delete this page. One surface, and
   the marketing link still lands somewhere that exists in the menu.
2. Connect it to the sidebar and accept two entries telling the same story.
   That is how a product becomes hard to use.
3. Leave it. The landing page keeps sending prospects to a page they can never
   find again after signing up.

**Note on ordering, which will not be obvious later:** `/dashboard/analytics`
carries a "Generate snapshots" button. Until 2026-08-07 that button called a
writer which erased `avg_position` and `competitor_rates` across a brand's
whole history. It never fired in production _only because the page was
unreachable_. That writer is now deleted (`b17a4d7`), so connecting the page is
safe — but it was not safe before, and nothing in the page itself would have
told you.

**Depends on:** the cost-page decision depends on entry 2.

---

## 2. Consolidate three parallel cost subsystems

**What:** Three implementations of API cost tracking coexist, none visible to users.

1. `services/api-cost-overview.ts` (507 lines) + `/api/api-costs` + export +
   tests → the page it should feed is a placeholder.
2. `/dashboard/cost-monitor` (513 lines) + `/api/cost-monitor` → orphaned.
3. `lib/cost-monitor/*` (`CostTracker`, `CostAnalyticsService`,
   `PROVIDER_PRICING`, `PROVIDER_DEFAULT_MODELS`) → entirely dead per knip.

**Why:** Three answers to one question means no answer. When someone asks what
the platform spends, there is no single place to look, and two of the three will
drift out of correctness unnoticed because nothing exercises them.

**Pros:** Picking one and deleting two removes a large amount of code and makes
spend answerable.

**Cons:** Requires deciding whether cost tracking is a product surface at all —
the current deployment runs unmetered on purpose.

**Context:** `api-cost-overview.ts` is the most complete and best documented, and
already handles sub-cent float accumulation correctly. It is the natural survivor
if the feature is kept.

**Depends on:** Related to TODO 3 below — none of the three detects an exhausted
API key, which is the thing that actually went wrong on 2026-08-07.

---

## 3. ~~Surface provider credit state in the cost/health UI~~ — DONE 2026-08-07

Detection landed in `27c6839`; the surfacing landed in `bfa9f7c` as a TopBar
badge, present on every page.

The design decision worth keeping: it renders **nothing** unless a provider is
confirmed to be refusing billed calls. Not for unknown state — credit is learned
from real traffic, so a provider nobody has called has no verdict — and a failed
poll never clears a live warning. A badge that is always on screen stops being
read, and is then worth nothing on the day it matters.

The rule lives in `lib/providers/credit-warning` as a pure function rather than
inside the component, because the project has no React component testing setup
and adding one for a badge was not worth a new dependency. Eight tests, most of
them asserting cases where nothing should appear.

---

## 4. Fix the breadcrumb gap on seven sidebar pages

**What:** `BREADCRUMB_MAP` in `components/layout/TopBar.tsx` was never updated as
pages were added. These seven fall through to the generic title "Dashboard":
`geo-score`, `citation-sources`, `aeo-snippets`, `ai-funnel`, `advisor`,
`site-audit`, `content-generator`.

**Why:** GEO Score is the product's headline metric and its page is titled
"Dashboard". Small, but it reads as unfinished.

**Pros:** Roughly a ten-line fix.

**Cons:** The map is a second source of truth for navigation alongside
`NAV_SECTIONS`. Deriving titles from `NAV_SECTIONS` instead would fix it
permanently, which is slightly more work and slightly better.

**Depends on:** Nothing.

---

## 5. ~~Reconcile the checked-in schema files with the live database~~ — DONE 2026-08-07

Resolved while clearing the issue #25 Phase 0 blocker. Kept here as the record of
what was found and why the fix took the shape it did.

**What was wrong:** three descriptions of one database disagreed.

- `supabase/schema.sql` described **14 of 64** tables, with 9 column-level drifts:
  `citation_snapshots.project_id` (live: `brand_id`), `brand_health_scores` missing
  the five score columns while declaring a `domain_authority` that does not exist,
  `brands` missing 8 columns, `keyword_tracking` missing 11 and declaring 2 that do
  not exist, `monitoring_results` missing 13.
- `src/types/database.ts` was missing the whole `geo_score_snapshots` table and the
  `citation_source` / `response_provider` columns on `monitoring_results` — the
  latter already referenced by `monitoring.ts` at runtime.
- `prisma/schema.prisma` lacked 21 runtime models.

**What was done:**

- Regenerated `src/types/database.ts` from the live project. Purely additive:
  66 insertions, 0 deletions. `tsc` clean, 1826 tests green.
- Deleted `supabase/schema.sql`. It had **zero consumers** — nothing in the CLI
  config, CI, scripts, or docs referenced it — while `check:drift` confirms
  0 runtime tables lack a `CREATE TABLE` in `supabase/migrations/`. The migrations
  rebuild the database completely, so the file was redundant _and_ wrong. Recover
  with `git checkout HEAD~1 -- supabase/schema.sql` if it is ever wanted back.
- Left `prisma/schema.prisma` alone. `grep -rl @prisma/client src` is empty —
  nothing queries this database through Prisma, and `scripts/audit-prisma-drift.mjs`
  already documents that as a deliberate choice.

**What is still open:** the source of truth is now `supabase/migrations/` plus the
generated types, but nothing _enforces_ that the types are regenerated after a
migration. `check:drift` measures and exits 0. Making it gate would need
`SUPABASE_DB_URL`, which this environment does not have.

---

## 6. Remove the third robots.txt parser

**What:** After issue #25 PR3 consolidates `crawlability.ts` onto
`crawler-access-audit.ts`, a third parser remains at
`services/technical-seo-audit.ts:79`.

**Why:** Two parsers already produced three defects and a wrong bot registry.
Leaving a third means the same class of divergence returns.

**Pros:** Finishes the consolidation properly.

**Cons:** `technical-seo-audit` may need only a narrow subset, in which case a
shared helper is the right shape rather than full reuse.

**Depends on:** issue #25 PR3.

---

## 7. Consolidate the two PDF builders

**What:** `services/pdf-generator.ts` and an inline builder in
`app/api/export/route.ts` both construct jsPDF reports. Only the first renders the
white-label logo.

**Why:** The logo bug was a symptom. Two builders means every report improvement
has to be made twice, and will not be.

**Pros:** One report path, one place to improve.

**Cons:** The two may have diverged in layout; merging needs a visual diff of real
output.

**Context:** issue #25 PR3 fixes the logo handling. That is the moment to merge
them rather than fixing the same thing in two places.

**Depends on:** issue #25 PR3.

---

## 8. Enforce or delete the declared limit constants

**What:** `lib/constants.ts:118-121` declares `MAX_COMPETITORS = 3`,
`MAX_SCAN_HISTORY = 50`, `MAX_TEXT_LENGTH = 15_000`,
`KEYWORD_DENSITY_TARGET = 2.5`. None is referenced anywhere.

**Why:** The competitor cap is the live one. `validations.ts:46` hardcodes a max of
3 on `competitorSchema`, duplicating the constant, while `brandStringArray` at
`:123` caps at **100** and is what brands actually use. A brand created through
the public API can carry 100 competitors while the UI and comparison logic assume 3. `calculateCitationSnapshots` loops every competitor inside its
engine × category × language triple loop, so the write cost scales with that
number.

**Pros:** Closes a real inconsistency with a performance tail.

**Cons:** Deciding the true cap is a product call, and lowering it below what some
brand already has needs a migration story.

**Depends on:** Interacts with the batching work in issue #25 PR1.

---

## 9. Decide whether AVI and GEO Score should share pillar weights

**What:** The two headline composites weight the same six signals differently:
citation 20% vs 30%, mention 20% vs 25%, sentiment 15% vs part of a combined 10%,
hallucination 10% vs the other part of that 10%. Recommendation and position match
at 20% and 15%.

**Why:** issue #25 corrects the position _formula_ so both scorers normalise
identically, but deliberately leaves the _weights_ different. That ships a release
whose stated purpose is metric correctness with two headline numbers that still
disagree by construction. Defensible as two lenses — but it should be a stated
decision with a visible explanation, not an omission a customer discovers.

**Pros:** Either unify them or document them; both beat the current silence.

**Cons:** Unifying changes customer-visible scores a second time, shortly after the
position correction already moved them.

**Context:** Raised by the adversarial review pass on issue #25 and consciously
deferred there.

**Depends on:** issue #25 PR4 should land first.

---

## 10. Clean up remaining dead code and cascading-render warnings

**What:** From `knip` and `eslint`: two dead files (`LottieAnimation.tsx`,
`use-scroll-reveal.ts`), an unused `lottie-web` dependency, 30 unused exports, and
6 synchronous `setState` calls inside effects (`AnimatedStats`, `Reveal`,
`TopicFinderPanel`, `Chart`, `useAeoRunStatus`, `chart-tokens`).

Also dead React state that signals removed features: `theme`/`setTheme`/`mounted`
in `TopBar` (the theme toggle was removed, the hook stayed), and unused
`selectedEngine` / `languageSnapshots` in the Citations page.

**Why:** Low individual value, but the dead state is misleading — it reads as a
feature that exists.

**Pros:** Mechanical and safe.

**Cons:** Genuinely low priority. Do it when touching these files for other
reasons.

**Depends on:** Nothing.

---

## 11. Two glossaries, different contents, one of them wrong

**What:** The product carries two glossaries that can and do disagree.

- `lib/data/glossary.ts` — 11 structured terms. Consumed by `/api/glossary`,
  and by `/api/recommendations` and `services/gemini.ts` through
  `buildGlossaryContext` / `buildAnalysisGlossaryContext`. **This is what the AI
  models read when scoring and recommending.**
- `app/dashboard/docs/page.tsx` — 13 terms, hardcoded inline. **This is what
  the user reads.**

**Why:** They already differ in count, and nothing keeps them in step. Worse,
the user-facing copy documents a defect: it defines Citation Rate as "the
percentage of monitored AI responses that **mention** your brand", which is the
mention rate. That is the same conflation found in `citation_snapshots`, where a
column named `citation_rate` is computed from `brand_mentioned` while
`brand_health_scores.citation_rate` is a genuine citation rate derived from
`cited_urls`. The glossary teaches the customer the wrong definition.

**Pros:** Sourcing the docs section from `lib/data/glossary` gives one
definition per term, and it is the definition the model is already using.

**Cons:** The structured source has fewer terms, so the two would have to be
merged rather than one simply replacing the other — and merging means deciding
which wording is right, including for Citation Rate.

**Context:** Found while deleting `/dashboard/glossary` (entry 1). That page
rendered the _structured_ source, so removing it means users now only ever see
the hardcoded copy. No terms were lost — docs has more — but the drift risk got
one surface quieter rather than smaller.

**Depends on:** the Citation Rate wording depends on entry 9's decision about
what the metric should mean.

---

## 12. The test suite fails intermittently, and nobody knows why

**What:** Across roughly ten full runs of unchanged trees on 2026-08-07 and
2026-08-10, the suite produced: one run with 4 failed tests across 3 files, one
reporting "6 errors" (unhandled, not assertion failures), one with 2 failures,
and the rest completely clean.

**NAMES CAPTURED 2026-08-10** — the first time a failing run was read before the
next one went green:

```
cron-credit-metering.test.ts
  ✗ credit metering charges the prompt owner and runs no engine when credits are refused
  ✗ credit metering a refused tenant does not stop the next tenant from running
```

Both pass in isolation, repeatedly. They failed in a run that shared the machine
with `npm run build` in the same shell command — which is the strongest evidence
yet for the contention theory below.

**Why:** A suite that fails at random makes a green run weak evidence. Every
"tests pass" claim in the 2026-08-07 work rests on runs that could have gone the
other way, and the next person to hit a red build will reasonably assume their
change caused it and go looking in the wrong place.

**What was ruled out:** the obvious suspect was tests making real network calls,
because `Groq HTTP 429` and `Cerebras HTTP 429` appear in the output on every
run. They are **not** real: `callllm-fallback.test.ts` stubs `global.fetch` by
URL and blanks the provider env keys first, precisely so real keys cannot leak
into the chain. Those 429s are simulated, and the warnings are the code under
test behaving correctly. Checked and dismissed.

**Leading hypothesis, unproven:** resource contention causing timeouts. Run
duration on identical code varied from 77s to 216s — nearly 3× — and the bad
runs coincided with other heavy work on the same machine. `vi.stubGlobal` on
`fetch` combined with `vi.resetModules()` across parallel workers is the other
candidate worth examining.

**How to pin it down:** run the suite in a loop capturing JSON output per run
(`--reporter=json --outputFile=...`) until it goes red, then read the captured
names rather than re-running. Consider `--pool=forks` or reducing concurrency to
test the contention theory, and raising `testTimeout` to see whether the
failures are timeouts wearing a disguise.

**Pros:** A deterministic suite is the foundation every other guarantee in this
repo stands on, including the audit scripts added on 2026-08-07.

**Cons:** Intermittent failures are expensive to chase, and this one has a low
rate — roughly 1 run in 3 at worst, and 4 consecutive clean runs at best.

**Depends on:** Nothing.
