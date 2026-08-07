# TODOS

Deferred work with enough context to pick up cold. Each entry records why it was
deferred, not just what it is.

Sources: `RAPPORTO-ANALISI-SEZIONI-2026-08-07.md` (diagnostic, file:line evidence)
and issue #25 (refactor plan + engineering review). Both are dated snapshots;
this file is the living list.

---

## 1. Decide the fate of ~1800 lines of unreachable dashboard pages

**What:** Four pages exist, render, and are wired to working APIs, but have zero
inbound links from anywhere in the app. Connect them or delete them.

| Page | Lines | Note |
|---|---|---|
| `/dashboard/overview` | 683 | Richer than the `/dashboard` that is actually linked. Uses `useRealtime`. |
| `/dashboard/cost-monitor` | 513 | Complete cost UI, fully orphaned. |
| `/dashboard/analytics` | 505 | Has a `BREADCRUMB_MAP` title but no link anywhere. |
| `/dashboard/glossary` | 135 | Nothing points at it. |

**Why:** Shipped code nobody can reach is pure carrying cost — it appears in
builds, in dependency graphs, and in every future refactor's blast radius, while
returning nothing. `/dashboard/overview` is the sharp case: it is the better
version of the page users actually land on.

**Pros:** Either outcome is a win. Connecting recovers finished features for
free; deleting shrinks the surface every future change has to consider.

**Cons:** Requires a product judgement per page, not a mechanical fix. Connecting
means each page must actually be good enough to show.

**Context:** Found by diffing `NAV_SECTIONS` in `components/layout/Sidebar.tsx`
against the 47 files under `app/dashboard/`, then grepping for inbound links.
`/dashboard/tools/prompt-generator` is a deliberate redirect and `api-costs`,
`billing`, `credits` are deliberate placeholders for unmetered mode — those four
are not orphans and should be left alone.

**Depends on:** Nothing. Independent of the issue #25 work.

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

## 3. Surface provider credit state in the cost/health UI

**What:** Once passive credit detection lands (issue #25, PR3), surface it
somewhere an operator will see before a customer does.

**Why:** On 2026-08-07 the Anthropic key returned "credit balance is too low" on
every call and no part of the product noticed — not Engine Info, not any cost
dashboard, not alerts. The detection is being built; the surfacing is not.

**Pros:** Turns a silent outage into a visible one. Cheap once detection exists.

**Cons:** Needs a home, which depends on TODO 2.

**Depends on:** issue #25 PR3 (passive credit detection), and TODO 2 for where it
lives.

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
  rebuild the database completely, so the file was redundant *and* wrong. Recover
  with `git checkout HEAD~1 -- supabase/schema.sql` if it is ever wanted back.
- Left `prisma/schema.prisma` alone. `grep -rl @prisma/client src` is empty —
  nothing queries this database through Prisma, and `scripts/audit-prisma-drift.mjs`
  already documents that as a deliberate choice.

**What is still open:** the source of truth is now `supabase/migrations/` plus the
generated types, but nothing *enforces* that the types are regenerated after a
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
the public API can carry 100 competitors while the UI and comparison logic assume
3. `calculateCitationSnapshots` loops every competitor inside its
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

**Why:** issue #25 corrects the position *formula* so both scorers normalise
identically, but deliberately leaves the *weights* different. That ships a release
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
