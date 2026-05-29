# Diagnostic Report — AEO Pulse

**Date**: 2026-05-25  
**Branch**: main (00b5e3a)  
**Commit**: `fix(aeo-snippets): surface post-run errors after load() clears them`

---

## CODE HEALTH DASHBOARD

| Category       | Tool             | Score   | Status       | Duration | Details                     |
|----------------|------------------|---------|--------------|----------|-----------------------------|
| Type check     | tsc --noEmit     | 10/10   | CLEAN        | 18s      | 0 errors                    |
| Lint           | eslint .         | 0/10    | CRITICAL     | 35-46s   | 1 error, 392 warnings       |
| Tests          | vitest           | 10/10   | CLEAN        | 114s     | 1389 passed, 2 skipped      |
| Dead code      | knip             | SKIPPED | CRASHED      | 3s       | RangeError (memory)         |
| Shell lint     | shellcheck       | SKIPPED | N/A          | N/A      | 1 husky stub script only    |
| GBrain         | gbrain doctor    | SKIPPED | N/A          | N/A      | Not configured              |

**COMPOSITE SCORE: 7.4 / 10** (dead code, shell, gbrain skipped — weights redistributed)

---

## LINT DETAILS (CRITICAL — 1 error, 392 warnings)

### Error (1)

| File | Line | Rule | Message |
|------|------|------|---------|
| `src/app/api/audit/mention-injection/route.ts` | 120 | `prefer-const` | `'inputPages'` is never reassigned. Use `const` instead |

### Warning breakdown (392 total)

| Rule | Count | Severity |
|------|-------|----------|
| `@typescript-eslint/no-explicit-any` | **179** | warning |
| `@typescript-eslint/no-unused-vars` | **173** | warning |
| `react-hooks/rules-of-hooks` / `react-hooks/exhaustive-deps` | **25** | warning |
| Various (prefer-const, etc.) | **~15** | warning |

### Files with 2+ warnings (top 15)

| Issues | Files |
|--------|-------|
| 11+ | `src/lib/services/llms-enrichment.ts` (no-explicit-any cluster) |
| 8 | `src/app/api/credits/route.ts` (no-explicit-any) |
| 8+ | `src/app/api/brands/route.ts` (no-explicit-any + unused) |
| 4+ | `src/app/api/billing/webhook/route.ts` (no-explicit-any) |
| 4+ | `src/app/api/credits/use/route.ts` (no-explicit-any + unused) |
| 4+ | `src/lib/services/preset-feedback.ts` (no-explicit-any + unused logger) |
| 3+ | `src/app/api/cron/monitoring/route.ts` (unused vars) |
| 2 | `src/hooks/useAeoRunStatus.ts` |
| 2 | `src/app/page.tsx` |
| 2 | `src/components/ThemeToggle.tsx` |
| 2 | `src/components/ui/Chart.tsx` |
| 2 | `src/components/AnimatedStats.tsx` |
| 2 | `src/app/HomeContent.tsx` |
| 2 | `src/app/docs/page.tsx` |
| 2 | `src/app/team/accept/page.tsx` |

---

## TEST RESULTS (1389 passed, 2 skipped, 0 failed)

| Metric | Value |
|--------|-------|
| Test files | 91 passed (91 total) |
| Tests | 1389 passed, 2 skipped |
| Duration | 111.69s (environment: 577s) |
| Exit code | 0 (PASS) |

### Warnings during test run (non-blocking)

```
callLLM: provider groq failed, falling back — Groq HTTP 429
callLLM: provider cerebras failed, falling back — Cerebras HTTP 429
```

These are test-time API rate limits against external LLM providers (expected in test env without API keys).

### Skipped tests (2)

Not specified — likely conditional/feature-gated tests.

---

## DEAD CODE ANALYSIS (FAILED)

knip v6.14.2 crashed with `RangeError: Array buffer allocation failed` (oxc-parser OOM on large project). Known issue on Windows with large repositories. Alternative approaches:

- Try `npx knip --max-old-space-size=4096`
- Use `ts-prune` as lighter-weight alternative
- Use `depcheck` for dependency-level analysis

---

## SHELL SCRIPTS

1 non-node_modules shell script found (`.husky/_/husky.sh` — legacy husky stub that prints a deprecation warning). Not worth linting.

---

## KEY ISSUES IDENTIFIED

### S1 — Critical

1. **Lint: 179 `no-explicit-any`** — Widespread type-safety bypass. Direct violation of AGENTS.md Sec 5.1 ("zero new `(db as any)` or `as any`"). The T03 task reduced `(db as any)` instances but `any` in function signatures (e.g., `(data: any)`, `(err: any)`) remains pervasive.

2. **Lint: 173 `no-unused-vars`** — Dead code accumulation. Variables imported but never used, functions defined but never called (e.g., `createServerClient` in `query-orchestrator.ts`, `getProviderFromModel` in `cost-aggregator.ts`, `logger` in `preset-feedback.ts`).

### S2 — High

3. **Lint error at `mention-injection/route.ts:120`** — Single `prefer-const` violation. Trivial to fix but blocks clean CI exit.

4. **25 `react-hooks` warnings** — Including `setState-in-effect` at `HomeContent.tsx:66` (cascading render anti-pattern). Plus potential missing dependencies in `useEffect` arrays.

### S3 — Medium

5. **Error handling gaps exposed in tests** — The 3 LLM provider fallback warnings during tests suggest the `callLLM` fallback chain may silently catch errors rather than propagating them. Review whether test stubs are properly isolating external API calls.

6. **3 npm warnings during test runner** — `npm warn "verbose" is being parsed as a normal command line argument` and `Unknown cli config "--run"` suggest vitest CLI args aren't properly forwarded through the npm script.

### S4 — Low

7. **husky v10 deprecation** — `.husky/_/husky.sh` prints deprecation warning. Will break in husky v10. Should migrate to new `.husky/pre-commit` format (no shell wrapper needed).

8. **No `e2e` test run in diagnostics** — `e2e/auth.spec.ts` exists but wasn't tested. Only 1 Playwright spec file exists.

---

## RECOMMENDATIONS (by impact)

```
1. [HIGH]  Fix 179 no-explicit-any warnings (Lint: 0/10, weight 18%)
   Impact: 1.8 composite points if brought to 10/10
   Run: npx eslint . --rule '@typescript-eslint/no-explicit-any: error' --format compact

2. [HIGH]  Fix 173 no-unused-vars warnings (Lint: same category, weight 18%)
   Impact: Removes noise from CI dashboard
   Run: npx eslint . --rule '@typescript-eslint/no-unused-vars: error' --format compact

3. [MED]   Fix prefer-const error (1 character change)
   File: src/app/api/audit/mention-injection/route.ts:120
   Fix: change `let inputPages` to `const inputPages`

4. [MED]   Fix HomeContent.tsx setState-in-effect anti-pattern
   File: src/app/HomeContent.tsx:66
   Suggestion: use useSyncExternalStore or conditional rendering instead of useEffect

5. [LOW]   Migrate husky to v10 format
   Action: replace .husky/_/husky.sh with inline scripts per husky docs
```

---

## TIMELINE COMPARISON (first run)

This is the first diagnostic snapshot. No trend data available yet. Run `/health` again after changes to track progress.

---

*Report generated by opencode diagnostic analysis. No code was modified.*
