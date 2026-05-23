import { describe, it, expect } from 'vitest'
import { classifyCitation, classifyCitationWithHost } from '@/lib/utils/citation-classifier'

describe('classifyCitation', () => {
  describe('multimedia', () => {
    it('detects video hosts', () => {
      expect(classifyCitation('https://www.youtube.com/watch?v=abc')).toBe('multimedia')
      expect(classifyCitation('https://youtu.be/abc')).toBe('multimedia')
      expect(classifyCitation('https://vimeo.com/12345')).toBe('multimedia')
      expect(classifyCitation('https://www.tiktok.com/@user/video/789')).toBe('multimedia')
    })

    it('detects image hosts and CDNs', () => {
      expect(classifyCitation('https://imgur.com/gallery/x')).toBe('multimedia')
      expect(classifyCitation('https://unsplash.com/photos/foo')).toBe('multimedia')
      expect(classifyCitation('https://cdn.shopify.com/s/files/img.png')).toBe('multimedia')
    })

    it('detects audio hosts', () => {
      expect(classifyCitation('https://soundcloud.com/artist/track')).toBe('multimedia')
      expect(classifyCitation('https://open.spotify.com/track/xyz')).toBe('multimedia')
    })

    it('detects file extensions even on neutral hosts', () => {
      expect(classifyCitation('https://example.com/uploads/photo.JPG')).toBe('multimedia')
      expect(classifyCitation('https://example.com/clip.mp4')).toBe('multimedia')
      expect(classifyCitation('https://example.com/asset.webp')).toBe('multimedia')
    })
  })

  describe('product', () => {
    it('detects e-commerce hosts (incl. localized Amazon)', () => {
      expect(classifyCitation('https://www.amazon.com/dp/B08')).toBe('product')
      expect(classifyCitation('https://www.amazon.it/qualcosa/dp/B08')).toBe('product')
      expect(classifyCitation('https://www.ebay.it/itm/123')).toBe('product')
      expect(classifyCitation('https://www.etsy.com/listing/456')).toBe('product')
      expect(classifyCitation('https://www.zalando.it/scarpe-foo/')).toBe('product')
    })

    it('detects product path segments on neutral hosts', () => {
      expect(classifyCitation('https://brand.com/product/widget-001')).toBe('product')
      expect(classifyCitation('https://brand.com/shop/category/item')).toBe('product')
      expect(classifyCitation('https://brand.com/collections/spring-2026')).toBe('product')
      expect(classifyCitation('https://brand.com/p/whatever')).toBe('product')
    })

    it('detects product query keys', () => {
      expect(classifyCitation('https://brand.com/x?sku=ABC123')).toBe('product')
      expect(classifyCitation('https://brand.com/x?product_id=42')).toBe('product')
      expect(classifyCitation('https://brand.com/x?asin=B08')).toBe('product')
    })
  })

  describe('informational (default)', () => {
    it('returns informational for blog/news/wiki/docs URLs', () => {
      expect(classifyCitation('https://en.wikipedia.org/wiki/SEO')).toBe('informational')
      expect(classifyCitation('https://nytimes.com/article/foo')).toBe('informational')
      expect(classifyCitation('https://docs.python.org/3/library/json.html')).toBe('informational')
      expect(classifyCitation('https://reddit.com/r/SEO/comments/abc')).toBe('informational')
      expect(classifyCitation('https://example.com/blog/why-x-matters')).toBe('informational')
    })

    it('returns informational for empty / invalid input (never throws)', () => {
      expect(classifyCitation('')).toBe('informational')
      expect(classifyCitation('not a url')).toBe('informational') // URL parser may still accept it with https://
      expect(classifyCitation('   ')).toBe('informational')
    })
  })

  describe('precedence', () => {
    it('multimedia beats product when the host is a multimedia host', () => {
      // An Instagram product post still classifies as multimedia.
      expect(classifyCitation('https://www.instagram.com/p/abc')).toBe('multimedia')
      // YouTube video that ALSO has /product/ in some path — still multimedia.
      expect(classifyCitation('https://www.youtube.com/product/foo')).toBe('multimedia')
    })

    it('product beats informational on file extension fallback', () => {
      expect(classifyCitation('https://brand.com/shop/item-001')).toBe('product')
    })
  })
})

describe('classifyCitationWithHost', () => {
  it('returns both type and normalized host', () => {
    expect(classifyCitationWithHost('https://WWW.Amazon.com/dp/B08')).toEqual({
      type: 'product',
      host: 'amazon.com',
    })
  })

  it('returns null host on un-parseable input but still a valid type', () => {
    const result = classifyCitationWithHost('')
    expect(result.type).toBe('informational')
    expect(result.host).toBeNull()
  })
})
