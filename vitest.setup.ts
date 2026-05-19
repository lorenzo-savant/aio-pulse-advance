import '@testing-library/jest-dom'
import { vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// @sentry/nextjs cannot initialise outside a real Next.js runtime — its module
// entry chains into `nextConfig.config` and crashes vitest at module load.
// Anything that imports `@/lib/logger` or `@/lib/ratelimit` pulls Sentry in
// transitively, which was breaking 5 test files (safe-fetch, ratelimit,
// billing-webhook, cron-monitoring, technical-seo-audit) with a confusing
// "Cannot read properties of undefined (reading 'config')" at line 1 of each.
//
// Mock it once here as a no-op surface that satisfies every call site.
// Tests can still override per-test with vi.mock if they need to assert
// against specific Sentry calls.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
  withScope: vi.fn((cb: (scope: unknown) => void) =>
    cb({ setTag: vi.fn(), setContext: vi.fn(), setUser: vi.fn() }),
  ),
  startSpan: vi.fn(<T>(_opts: unknown, cb: () => T) => cb()),
  init: vi.fn(),
  getClient: vi.fn(() => null),
  getCurrentScope: vi.fn(() => ({
    setTag: vi.fn(),
    setContext: vi.fn(),
    setUser: vi.fn(),
  })),
  flush: vi.fn(async () => true),
}))
