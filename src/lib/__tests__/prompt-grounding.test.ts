import { describe, it, expect } from 'vitest'
import { isNonSellerBrand, presupposesOwnProducts } from '../services/prompt-generator-ai'

// The deterministic backstop for rule 11: a brand that sells nothing of its own
// (a meta-search / comparison / aggregator) must never get "what products does
// X sell" prompts, even when the model ignores the prompt rules. These tests
// pin the classifiers — especially their FALSE-POSITIVE boundaries, so we don't
// silently drop legitimate prompts.

describe('isNonSellerBrand', () => {
  it('flags the re-commerce/price-comparison industry outright', () => {
    expect(isNonSellerBrand('recommerce-comparison', '')).toBe(true)
  })

  it('flags a brand whose verified facts describe a meta-search / comparison', () => {
    expect(isNonSellerBrand('ecommerce', 'En sökmotor som jämför priser på begagnat')).toBe(true)
    expect(isNonSellerBrand('other', 'A price-comparison platform / aggregator')).toBe(true)
    expect(isNonSellerBrand('ecommerce', 'Comparatore che confronta prezzi tra venditori')).toBe(
      true,
    )
  })

  it('does NOT flag a genuine seller', () => {
    expect(isNonSellerBrand('ecommerce', 'Vi säljer ekologiska hudvårdsprodukter')).toBe(false)
    expect(isNonSellerBrand('ecommerce', '')).toBe(false)
  })
})

describe('presupposesOwnProducts', () => {
  it('catches the trap prompt in every locale (sell-verb + product-noun)', () => {
    expect(presupposesOwnProducts('Vilka produkter säljer Relovie AB?')).toBe(true)
    expect(presupposesOwnProducts('What products does Relovie sell?')).toBe(true)
    expect(presupposesOwnProducts('Quali prodotti vende Relovie?')).toBe(true)
  })

  it('does NOT catch a product-noun without a sell-verb (compare/buy prompts)', () => {
    expect(presupposesOwnProducts('Var jämför jag priser på produkter billigast?')).toBe(false)
    expect(presupposesOwnProducts('Var köper jag begagnad elektronik billigast?')).toBe(false)
    expect(presupposesOwnProducts('bästa sajt för att jämföra priser på begagnat')).toBe(false)
  })

  it('does NOT catch a sell-verb without a product-noun (seller-side prompts)', () => {
    // "how do I sell on X" is a legitimate marketplace question.
    expect(presupposesOwnProducts('Hur säljer jag på Relovie?')).toBe(false)
    expect(presupposesOwnProducts('Come vendo su Relovie?')).toBe(false)
  })
})
