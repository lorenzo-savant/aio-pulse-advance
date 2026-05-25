'use client'

// Hydration-safe mounted flag. Returns false on the server + first client
// render, then true on the second client render. Use it to gate UI that
// MUST not differ between server-rendered HTML and the first client paint
// (e.g. next-themes' resolved theme — the icon depends on a client-only
// store, which would otherwise produce a hydration mismatch).
//
// The setState-in-effect lives here in ONE place. The lint rule
// react-hooks/set-state-in-effect generally protects against cascading-
// render anti-patterns, but the "flip-once-on-mount" pattern is the
// canonical fix for hydration mismatches and is documented by the
// next-themes README + React docs. Disable it once, here, with rationale —
// callers stay clean.

import { useEffect, useState } from 'react'

export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])
  return mounted
}
