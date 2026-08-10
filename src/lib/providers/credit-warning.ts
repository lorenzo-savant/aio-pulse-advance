// PATH: src/lib/providers/credit-warning.ts
//
// Decides whether an operator needs to be told that a provider has stopped
// accepting billed calls, and what to say. Pure, so the rule is testable
// without a DOM — the rendering in components/layout/ProviderCreditWarning is
// deliberately trivial and this is where the judgement lives.
//
// WHY THE RULE MATTERS MORE THAN THE BADGE
// On 2026-08-07 the Anthropic key returned "Your credit balance is too low" on
// every request and nothing in the product said so. Engine Info reported Claude
// as operational because its status was a hardcoded literal, no cost dashboard
// is reachable from the sidebar, and no alert rules are configured. The outage
// was invisible until someone queried the provider's own API by hand.
//
// The thing that makes a warning like this useless is not failing to fire —
// it is firing when nothing is wrong. A badge that is always on screen stops
// being read, and is then worth nothing on the day it matters.

/** The subset of /api/providers/health this rule needs. */
export interface ProviderCreditState {
  id: string
  name: string
  /**
   * `true` a billed call was refused for billing reasons, `false` a billed
   * call has since succeeded, `null` nobody has made one yet.
   *
   * Credit state is learned from real traffic rather than probed, because no
   * probe can answer it without spending money: three of the four providers
   * expose only free `/models` endpoints, which return 200 on an empty
   * balance.
   */
  creditExhausted: boolean | null
}

export interface CreditWarning {
  /** Providers confirmed to be refusing billed calls. Never empty. */
  drained: ProviderCreditState[]
  /** Full sentence for the tooltip and the accessible label. */
  label: string
  /** Short form for the badge itself. */
  badge: string
}

/**
 * Returns `null` when there is nothing worth interrupting anyone about.
 *
 * Only a confirmed `true` counts. `null` — nobody has called this provider yet
 * — is not bad news, and reporting it as such would train operators to ignore
 * the badge, which is the failure mode this whole surface exists to avoid.
 */
export function buildCreditWarning(providers: unknown): CreditWarning | null {
  if (!Array.isArray(providers)) return null

  const drained = providers.filter(
    (p): p is ProviderCreditState =>
      !!p && typeof p === 'object' && (p as ProviderCreditState).creditExhausted === true,
  )

  if (drained.length === 0) return null

  const names = drained.map((p) => p.name).join(', ')

  return {
    drained,
    label:
      drained.length === 1
        ? `${names} has run out of credit and is not answering`
        : `${drained.length} providers have run out of credit: ${names}`,
    badge: drained.length === 1 ? `${drained[0]!.name} — no credit` : `${drained.length} providers`,
  }
}
