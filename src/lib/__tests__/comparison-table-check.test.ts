import { describe, it, expect } from 'vitest'
import { checkComparisonTable } from '@/lib/utils/comparison-table-check'

describe('checkComparisonTable', () => {
  it('skips when URL does not look like a pricing or comparison page', () => {
    const r = checkComparisonTable(
      '<html><body><img src="/assets/pricing-table.png"></body></html>',
      'https://acme.com/blog/some-post',
    )
    expect(r.verdict).toBe('skipped')
  })

  it('flags a /pricing page that only uses a screenshot for the table', () => {
    const html = `<html><body>
      <h1>Pricing</h1>
      <img src="/assets/pricing-table.png" alt="Acme pricing tiers">
      <p>Get started today.</p>
    </body></html>`
    const r = checkComparisonTable(html, 'https://acme.com/pricing')
    expect(r.verdict).toBe('vulnerable')
    expect(r.flaggedImages.length).toBeGreaterThan(0)
    expect(r.htmlTableCount).toBe(0)
  })

  it('passes when a /pricing page has an HTML <table> backing the screenshot', () => {
    const html = `<html><body>
      <h1>Pricing</h1>
      <img src="/hero.png" alt="acme pricing-table hero">
      <table>
        <tr><th>Plan</th><th>Price</th></tr>
        <tr><td>Starter</td><td>$29</td></tr>
      </table>
    </body></html>`
    const r = checkComparisonTable(html, 'https://acme.com/pricing')
    expect(r.verdict).toBe('ok')
    expect(r.htmlTableCount).toBe(1)
  })

  it('passes when a comparison page has no table-like images at all', () => {
    const html = `<html><body>
      <h1>Acme vs Rivalry</h1>
      <p>Decorative imagery only.</p>
      <img src="/logo.svg" alt="Acme logo">
      <table><tr><td>Feature</td><td>Acme</td><td>Rivalry</td></tr></table>
    </body></html>`
    const r = checkComparisonTable(html, 'https://acme.com/acme-vs-rivalry')
    expect(r.verdict).toBe('ok')
    expect(r.flaggedImages).toEqual([])
  })

  it('detects feature-matrix image on a /compare URL with zero <table>', () => {
    const html = `<html><body>
      <img src="https://cdn.acme.com/img/feature_matrix_2026.png" alt="">
    </body></html>`
    const r = checkComparisonTable(html, 'https://acme.com/compare')
    expect(r.verdict).toBe('vulnerable')
    expect(r.flaggedImages[0]).toContain('feature_matrix_2026.png')
  })

  it('uses Italian /prezzi URL hint', () => {
    const html = `<html><body><img src="/img/tabella-prezzi.jpg" alt=""></body></html>`
    const r = checkComparisonTable(html, 'https://acme.it/prezzi')
    expect(r.verdict).toBe('vulnerable')
  })
})
