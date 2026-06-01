import { describe, it, expect } from 'vitest'
import {
  normalizeLang,
  renderInvitationEmail,
  renderAlertEmail,
} from '@/lib/services/email-templates'

describe('normalizeLang', () => {
  it('maps known prefixes', () => {
    expect(normalizeLang('sv')).toBe('sv')
    expect(normalizeLang('sv-SE')).toBe('sv')
    expect(normalizeLang('it')).toBe('it')
    expect(normalizeLang('en-US')).toBe('en')
  })
  it('falls back to en for unknown/empty', () => {
    expect(normalizeLang(null)).toBe('en')
    expect(normalizeLang(undefined)).toBe('en')
    expect(normalizeLang('de')).toBe('en')
  })
})

describe('renderInvitationEmail', () => {
  const base = {
    brandName: 'Acme',
    inviterName: 'Lorenzo',
    role: 'editor',
    acceptUrl: 'https://aeo-pulse.savantmedia.se/team/accept?token=abc',
  }

  it('localizes subject + heading per language', () => {
    expect(renderInvitationEmail({ lang: 'en', ...base }).subject).toContain('invited')
    expect(renderInvitationEmail({ lang: 'sv', ...base }).subject).toContain('bjudits in')
    expect(renderInvitationEmail({ lang: 'it', ...base }).subject).toContain('invitato')
  })

  it('embeds brand, inviter, accept URL and teal wordmark', () => {
    const { html } = renderInvitationEmail({ lang: 'en', ...base })
    expect(html).toContain('Acme')
    expect(html).toContain('Lorenzo')
    expect(html).toContain(base.acceptUrl)
    expect(html).toContain('#0AD0BC') // brand teal
    expect(html).toContain('>AEO<') // wordmark split
  })

  it('translates the role label in Swedish', () => {
    const { html } = renderInvitationEmail({ lang: 'sv', ...base, role: 'viewer' })
    expect(html).toContain('Visning')
  })
})

describe('renderAlertEmail', () => {
  const base = {
    brandName: 'Acme',
    alertType: 'geo_score_drop',
    title: 'GEO Score dropped 12 pts',
    message: 'Investigate the pillar breakdown.',
    appUrl: 'https://aeo-pulse.savantmedia.se',
  }

  it('localizes the alert type label', () => {
    expect(renderAlertEmail({ lang: 'en', ...base }).html).toContain('GEO Score Drop')
    expect(renderAlertEmail({ lang: 'sv', ...base }).html).toContain('GEO Score-fall')
    expect(renderAlertEmail({ lang: 'it', ...base }).html).toContain('Calo GEO Score')
  })

  it('renders data rows when provided', () => {
    const { html } = renderAlertEmail({
      ...base,
      lang: 'en',
      data: { score: 58, previous_score: 70 },
    })
    expect(html).toContain('Score')
    expect(html).toContain('58')
    expect(html).toContain('70')
  })

  it('uses a red accent for negative alert types', () => {
    const { html } = renderAlertEmail({ lang: 'en', ...base })
    expect(html).toContain('#E0484D')
  })
})
