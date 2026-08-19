import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// The CSV export is the artefact a client opens to check our work. These tests
// pin what it must carry, at source level — the mapping lives inline in the
// route handler, so there is no exported function to call.
//
// Asserted against comment-stripped code: the file's comments quote the old
// broken shapes to explain them, and a naive match would fire on the
// explanation rather than on the code.

const rawSrc = readFileSync(join(process.cwd(), 'src/app/api/export/route.ts'), 'utf8')
const routeSrc = rawSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('monitoring CSV export', () => {
  it('carries the cited links — the evidence a client verifies', () => {
    expect(routeSrc).toMatch(/cited_urls:\s*Array\.isArray\(r\.cited_urls\)/)
  })

  it('carries the answer text the engine produced', () => {
    expect(routeSrc).toMatch(/response_text:\s*r\.response_text/)
  })

  it('carries the query fan-out and says whether it was captured', () => {
    // Empty because the engine did not search, and empty because the provider
    // hides its queries, look identical in a spreadsheet — hence the flag.
    expect(routeSrc).toMatch(/search_queries:\s*Array\.isArray\(r\.search_queries\)/)
    expect(routeSrc).toMatch(/search_queries_captured:\s*r\.search_queries == null/)
  })

  it('records which provider actually answered', () => {
    // Without it, a Gemini row served by the OpenAI fallback is indistinguishable
    // from a real Gemini measurement.
    expect(routeSrc).toMatch(/answered_by:\s*r\.response_provider/)
  })

  it('reads competitors from the column that exists', () => {
    // Regression: the mapping read r.competitors_mentioned, which is not a
    // column (the real one is competitor_mentions). That cell exported empty
    // for every row ever downloaded.
    expect(routeSrc).not.toMatch(/competitors_mentioned/)
    expect(routeSrc).toMatch(/r\.competitor_mentions/)
  })

  it('reads competitor names out of objects, not raw array join', () => {
    // competitor_mentions holds { name, position, count } objects; a bare
    // .join() would render "[object Object]" in the cell.
    expect(routeSrc).toMatch(/\.map\(asName\)/)
  })
})
