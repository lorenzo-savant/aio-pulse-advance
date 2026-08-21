// PATH: src/lib/services/confusable-citations.ts
//
// Look-alike citations — when the engines cite a different company that shares
// the brand's shape.
//
// Observed live on 2026-08-20. Asked to recommend Relovie AB, ChatGPT answered
// without running a single search (fan-out captured as empty, not NULL) and
// cited:
//
//   https://relivo.se
//   https://optiman.se/relivo-recension
//   https://se.trustpilot.com/review/relivo.se
//
// Relivo is a real, separate Swedish company. Those URLs were stored as
// citations for Relovie, where they are indistinguishable from a legitimate
// third-party source: they inflate the citation count, they enter the source
// ranking, and the source taxonomy files them as "unique" — a domain only we
// activate. Which is true, and completely misleading.
//
// So this is not a hallucination detector. The pages exist and the links work.
// It is an IDENTITY check: does this cited host belong to us, to a plausible
// third party, or to somebody whose name the engine confused with ours?
//
// WHY EDIT DISTANCE ALONE DOES NOT WORK
// "relovie" → "relivo" is a Levenshtein distance of 3 on a 7-character word —
// far outside any typo threshold that would not also flag half the web. But
// the two words are built from the same letters in a different order, and they
// share a three-letter prefix. That is what makes them confusable to a model
// that is recalling rather than reading. The rule below therefore accepts two
// independent triggers: a genuine typo distance, OR a shared prefix with an
// almost-identical letter multiset.
//
// Pure and deterministic — no DB, no network, no model call.

/** Registrable-ish label of a host: "www.relivo.se" → "relivo". Good enough
 *  for name confusion, which is what this file is about — it deliberately does
 *  not do public-suffix parsing, because "relovie" vs "relivo" is the same
 *  question on .se, .com or .co.uk. */
export function hostLabel(host: string): string {
  const clean = host
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]!
    .split(':')[0]!
  const parts = clean.split('.').filter(Boolean)
  if (parts.length === 0) return ''
  // Skip a country-code second level ("co.uk", "com.au") when present.
  if (parts.length >= 3 && parts[parts.length - 2]!.length <= 3) return parts[parts.length - 3]!
  return parts.length >= 2 ? parts[parts.length - 2]! : parts[0]!
}

/** Letters only, lowercased, accents folded — the comparison alphabet. */
export function foldName(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    prev = curr
  }
  return prev[b.length]!
}

/** How many letters have to be added or removed to turn one bag of letters
 *  into the other. Order-blind on purpose: it is what catches a name whose
 *  letters were remembered but reshuffled. */
function multisetDistance(a: string, b: string): number {
  const counts = new Map<string, number>()
  for (const ch of a) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  for (const ch of b) counts.set(ch, (counts.get(ch) ?? 0) - 1)
  let diff = 0
  for (const n of counts.values()) diff += Math.abs(n)
  return diff
}

function sharedPrefix(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

export interface BrandIdentity {
  name: string
  aliases?: readonly string[] | null
  domain?: string | null
}

export interface ConfusableVerdict {
  /** The brand spelling this host resembles. */
  similarTo: string
  /** Levenshtein distance to that spelling — reported so the operator can see
   *  how close the call was rather than trusting a boolean. */
  distance: number
  /** Which trigger fired: a typo-scale edit distance, or the same letters in a
   *  different order behind a shared prefix. */
  reason: 'typo' | 'reshuffled'
  /** Where the look-alike was found. 'host' is the strong signal. 'path' means
   *  the host is a third party (a directory, a review site) but the page it
   *  points to is about the look-alike company. */
  where: 'host' | 'path'
}

/** Shortest identity label we will compare. Below this, everything looks like
 *  everything: "abc" and "abd" are one edit apart and mean nothing. */
const MIN_LABEL = 4

function identityLabels(brand: BrandIdentity): string[] {
  const out: string[] = []
  const push = (raw: string | null | undefined) => {
    const folded = foldName(raw ?? '')
    if (folded.length >= MIN_LABEL && !out.includes(folded)) out.push(folded)
  }
  push(brand.name)
  for (const a of brand.aliases ?? []) push(a)
  if (brand.domain) push(hostLabel(brand.domain))
  return out
}

/** Is this label OURS — the brand itself rather than a look-alike? */
function isOwnLabel(label: string, labels: readonly string[]): boolean {
  // Exact match, or the brand name with a legal suffix folded in
  // ("relovieab" for "relovie"). Those are us, not an impostor.
  return labels.some((l) => l === label || l.startsWith(label) || label.startsWith(l))
}

function compare(label: string, identity: string): ConfusableVerdict | null {
  if (label.length < MIN_LABEL || identity.length < MIN_LABEL) return null
  const distance = levenshtein(label, identity)
  if (distance === 0) return null

  // A containment relationship is a shared generic word, not an impostor.
  // Verified against the live database: without this guard, brand 'acasting'
  // flagged starnow.com/casting, backstage.com/casting and its own
  // acasting.se/blog/...-casting-... — 505 hits, essentially all of them the
  // industry noun the brand name is built from. A look-alike REPLACES letters;
  // a generic word merely sits inside the name.
  if (label.includes(identity) || identity.includes(label)) return null

  // Trigger 1 — typo scale. One or two edits on a name of real length is the
  // classic look-alike domain.
  if (distance <= 2) {
    return { similarTo: identity, distance, reason: 'typo', where: 'host' }
  }

  // Trigger 2 — same letters, reshuffled, behind a shared prefix. This is the
  // relovie/relivo case, which no edit-distance threshold reaches.
  const prefix = sharedPrefix(label, identity)
  const lengthGap = Math.abs(label.length - identity.length)
  const letters = multisetDistance(label, identity)
  if (prefix >= 3 && lengthGap <= 3 && letters <= 3) {
    return { similarTo: identity, distance, reason: 'reshuffled', where: 'host' }
  }

  return null
}

/** The brand spelling a label resembles MOST, not merely the first one it
 *  resembles. A brand carries several spellings — the legal name, the short
 *  name, the domain label — and telling an operator that relivo.se "resembles
 *  relovieab" when it plainly resembles relovie is a worse answer for no
 *  reason. Ties go to the typo trigger, which is the more literal claim. */
function closest(label: string, labels: readonly string[]): ConfusableVerdict | null {
  let best: ConfusableVerdict | null = null
  for (const identity of labels) {
    const verdict = compare(label, identity)
    if (!verdict) continue
    if (
      !best ||
      verdict.distance < best.distance ||
      (verdict.distance === best.distance && verdict.reason === 'typo' && best.reason !== 'typo')
    ) {
      best = verdict
    }
  }
  return best
}

/**
 * Judge one cited URL against the brand's identity.
 *
 * Returns null for our own domains and for ordinary third parties — the two
 * cases that are not findings. A verdict means: the engine cited something
 * that wears this brand's name without being it.
 */
export function classifyCitedUrl(rawUrl: string, brand: BrandIdentity): ConfusableVerdict | null {
  const labels = identityLabels(brand)
  if (labels.length === 0) return null

  let host = ''
  let path = ''
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    host = u.hostname
    path = `${u.pathname}${u.search}`
  } catch {
    return null
  }

  const label = hostLabel(host)
  if (!label) return null

  if (!isOwnLabel(label, labels)) {
    const verdict = closest(label, labels)
    if (verdict) return verdict
  }

  // Our own pages are never a look-alike, whatever their URLs say.
  if (isOwnLabel(label, labels)) return null

  // The host is somebody else's — a directory, a review site. Its PATH can
  // still name the look-alike: se.trustpilot.com/review/relivo.se is a review
  // of the other company, cited as if it were about us.
  //
  // Paths are held to a stricter bar than hosts. A path is full of ordinary
  // words, so a two-edit resemblance there is usually a coincidence, not a
  // company: measured on the live database, the loose rule turned
  // reddit.com/r/acting into a look-alike of 'acasting'. Only the same letters
  // reshuffled, or a single-character difference, survive.
  const tokens = path
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= MIN_LABEL)
  for (const token of tokens) {
    if (isOwnLabel(token, labels)) continue
    const verdict = closest(token, labels)
    if (verdict && (verdict.reason === 'reshuffled' || verdict.distance <= 1)) {
      return { ...verdict, where: 'path' }
    }
  }

  return null
}

export interface ConfusableSource {
  /** Host as stored, normalised for display. */
  domain: string
  verdict: ConfusableVerdict
  /** How many citations pointed at it. */
  citations: number
  /** Up to three URLs, so the operator can check rather than believe. */
  sampleUrls: string[]
}

/**
 * Sweep every cited URL for look-alikes, grouped by host.
 *
 * Ordered by citation count: a look-alike the engines reach for repeatedly is
 * a market fact about the brand's name, not a one-off slip.
 */
export function findConfusableCitations(
  citedUrlLists: ReadonlyArray<readonly string[] | null>,
  brand: BrandIdentity,
): ConfusableSource[] {
  const byHost = new Map<string, ConfusableSource>()

  for (const urls of citedUrlLists) {
    for (const rawUrl of urls ?? []) {
      const verdict = classifyCitedUrl(rawUrl, brand)
      if (!verdict) continue
      let host: string
      try {
        host = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`).hostname.replace(
          /^www\./,
          '',
        )
      } catch {
        continue
      }
      const existing = byHost.get(host)
      if (existing) {
        existing.citations++
        if (existing.sampleUrls.length < 3 && !existing.sampleUrls.includes(rawUrl)) {
          existing.sampleUrls.push(rawUrl)
        }
        continue
      }
      byHost.set(host, { domain: host, verdict, citations: 1, sampleUrls: [rawUrl] })
    }
  }

  return [...byHost.values()].sort(
    (a, b) => b.citations - a.citations || a.domain.localeCompare(b.domain),
  )
}
