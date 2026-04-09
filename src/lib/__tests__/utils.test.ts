import { describe, it, expect } from 'vitest'
import {
  cn,
  formatNumber,
  formatPercent,
  formatDate,
  formatRelativeTime,
  truncate,
  slugify,
  capitalize,
  isValidUrl,
  normalizeUrl,
  groupBy,
  uniqueBy,
  omit,
  pick,
  generateId,
} from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-4 py-2', 'bg-red-500')).toBe('px-4 py-2 bg-red-500')
  })

  it('handles conditional classes', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
  })

  it('resolves conflicts with tailwind-merge', () => {
    expect(cn('px-4 py-2', 'px-8')).toBe('py-2 px-8')
  })
})

describe('formatNumber', () => {
  it('formats small numbers', () => {
    expect(formatNumber(100)).toBe('100')
  })

  it('formats thousands', () => {
    expect(formatNumber(1500)).toBe('1.5K')
  })

  it('formats millions', () => {
    expect(formatNumber(2500000)).toBe('2.5M')
  })
})

describe('formatPercent', () => {
  it('formats with default decimals', () => {
    expect(formatPercent(45.678)).toBe('45.7%')
  })

  it('formats with custom decimals', () => {
    expect(formatPercent(45.678, 2)).toBe('45.68%')
  })
})

describe('formatDate', () => {
  it('formats date with default options', () => {
    const result = formatDate('2024-01-15')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('accepts Date object', () => {
    const result = formatDate(new Date(2024, 0, 15))
    expect(result).toContain('Jan')
  })

  it('accepts timestamp', () => {
    const result = formatDate(1705276800000)
    expect(result).toContain('2024')
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for recent times', () => {
    expect(formatRelativeTime(Date.now())).toBe('just now')
  })

  it('returns minutes ago', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days ago', () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
  })
})

describe('truncate', () => {
  it('returns original string if shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
  })
})

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('HELLO WORLD')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(slugify('Hello @World!')).toBe('hello-world')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world test')).toBe('hello-world-test')
  })

  it('removes leading/trailing hyphens', () => {
    expect(slugify('  hello  ')).toBe('hello')
  })
})

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('lowercases the rest', () => {
    expect(capitalize('HELLO')).toBe('Hello')
  })
})

describe('isValidUrl', () => {
  it('validates https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
  })

  it('validates http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true)
  })

  it('normalizes URLs without protocol', () => {
    expect(isValidUrl('example.com')).toBe(true)
  })

  it('rejects empty strings', () => {
    expect(isValidUrl('')).toBe(false)
  })

  it('rejects too short hostnames', () => {
    expect(isValidUrl('http://a.b')).toBe(false)
  })
})

describe('normalizeUrl', () => {
  it('adds https to URLs without protocol', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
  })

  it('keeps existing protocol', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com')
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
  })
})

describe('groupBy', () => {
  it('groups objects by key', () => {
    const items = [
      { category: 'a', value: 1 },
      { category: 'b', value: 2 },
      { category: 'a', value: 3 },
    ]
    const result = groupBy(items, 'category')
    expect(result.a).toHaveLength(2)
    expect(result.b).toHaveLength(1)
  })
})

describe('uniqueBy', () => {
  it('returns unique items by key', () => {
    const items = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 1, name: 'c' },
    ]
    const result = uniqueBy(items, 'id')
    expect(result).toHaveLength(2)
  })
})

describe('omit', () => {
  it('removes specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 })
  })
})

describe('pick', () => {
  it('picks specified keys', () => {
    const obj = { a: 1, b: 2, c: 3 }
    expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 })
  })

  it('ignores non-existent keys', () => {
    const obj = { a: 1 }
    expect(pick(obj, ['a', 'b' as keyof typeof obj])).toEqual({ a: 1 })
  })
})

describe('generateId', () => {
  it('generates unique ids with default prefix', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).toMatch(/^id_\d+_[a-z0-9]+$/)
    expect(id1).not.toBe(id2)
  })

  it('generates ids with custom prefix', () => {
    const id = generateId('user')
    expect(id).toMatch(/^user_\d+_[a-z0-9]+$/)
  })
})
