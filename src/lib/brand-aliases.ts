// PATH: src/lib/brand-aliases.ts
//
// Auto-derive a brand alias by stripping a trailing legal-entity suffix
// (AB, S.r.l., Inc, GmbH, Ltd, AS, Oy, …). AI engines write "Savant Media",
// not "Savant Media AB" — and the exact-match brand detection requires the
// brand name (or a listed alias) as a whole word. Without this alias a brand
// with a legal suffix gets counted as un-mentioned (0 citation rate / 0
// visibility) even when the engines clearly talk about it. Applied on brand
// create/update so the match works for every brand without manual aliasing.

// Common legal-entity suffix tokens across the markets this product targets
// (Nordics, Italy, EN). Punctuation is stripped before matching, so "S.r.l.",
// "S.p.A.", "A/S" all reduce to a token here.
const LEGAL_SUFFIX_TOKENS = new Set([
  // Nordics
  'ab',
  'publ',
  'hb',
  'kb',
  'as',
  'asa',
  'oy',
  'oyj',
  'aps',
  // Italy / France / Spain
  'srl',
  'srls',
  'spa',
  'sapa',
  'sas',
  'sasu',
  'sa',
  'sl',
  'slu',
  'sarl',
  'snc',
  // Benelux / DACH
  'bv',
  'nv',
  'gmbh',
  'mbh',
  'ag',
  'kg',
  'ug',
  // EN
  'inc',
  'llc',
  'ltd',
  'ltda',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
  'plc',
  'pty',
  'llp',
  'pllc',
])

/**
 * Return the brand name with its trailing legal-entity suffix removed, or null
 * when there's nothing meaningful to strip (no suffix, or stripping would
 * leave too little). Handles multi-token suffixes ("Pty Ltd", "AB (publ)").
 */
export function stripLegalSuffix(name: string): string | null {
  const tokens = (name || '').trim().split(/\s+/)
  let end = tokens.length
  // Walk back over trailing suffix tokens (and stray punctuation tokens).
  while (end > 1) {
    const t = tokens[end - 1]!.toLowerCase().replace(/[.,/()&-]/g, '')
    if (t === '') {
      end--
      continue
    }
    if (LEGAL_SUFFIX_TOKENS.has(t)) {
      end--
      continue
    }
    break
  }
  if (end === tokens.length) return null // nothing stripped
  const stripped = tokens
    .slice(0, end)
    .join(' ')
    .replace(/[,&\s]+$/, '')
    .trim()
  if (stripped.length < 2) return null
  if (stripped.toLowerCase() === (name || '').trim().toLowerCase()) return null
  // Guard against a result that is itself just a lone suffix token (e.g.
  // "Co Ltd" → "Co"): not a usable brand alias.
  if (LEGAL_SUFFIX_TOKENS.has(stripped.toLowerCase().replace(/[.,/()&-]/g, ''))) return null
  return stripped
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of arr) {
    const key = a.toLowerCase()
    if (!a || seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

/**
 * Merge a brand's aliases with the auto-derived suffix-stripped name (when one
 * exists and isn't already present). Trims + de-dupes case-insensitively.
 */
export function withDerivedAliases(name: string, aliases: string[] = []): string[] {
  const cleaned = (aliases || []).map((a) => a.trim()).filter(Boolean)
  const stripped = stripLegalSuffix(name)
  if (!stripped) return dedupe(cleaned)
  const lower = stripped.toLowerCase()
  const already =
    lower === (name || '').trim().toLowerCase() || cleaned.some((a) => a.toLowerCase() === lower)
  return dedupe(already ? cleaned : [...cleaned, stripped])
}
