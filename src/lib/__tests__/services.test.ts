import { describe, it, expect } from 'vitest'

describe('JSON Repair Utility', () => {
  const repairTruncatedJson = (raw: string): string => {
    let s = raw.trim()
    const quoteCount = (s.match(/(?<!\\)"/g) || []).length
    if (quoteCount % 2 !== 0) s += '"'
    s = s.replace(/,\s*"[^"]*"\s*:\s*$/, '')
    s = s.replace(/,\s*"[^"]*"?\s*$/, '')
    s = s.replace(/,\s*$/, '')
    const stack: string[] = []
    let inString = false
    let escaped = false
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\' && inString) {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === '{') stack.push('}')
      else if (ch === '[') stack.push(']')
      else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) stack.pop()
      }
    }
    s = s.replace(/,\s*$/, '')
    while (stack.length > 0) s += stack.pop()
    return s
  }

  it('parses valid JSON', () => {
    const input = '{"visibilityScore": 85, "intent": "Informational"}'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result.visibilityScore).toBe(85)
  })

  it('closes unclosed string', () => {
    const input = '{"visibilityScore": 85, "intent": "Informational'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result.visibilityScore).toBe(85)
    expect(result.intent).toBe('Informational')
  })

  it('handles trailing comma in object', () => {
    const input = '{"visibilityScore": 85}'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result.visibilityScore).toBe(85)
  })

  it('closes unclosed objects', () => {
    const input = '{"visibilityScore": 85, "suggestions": ["test"'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result.visibilityScore).toBe(85)
    expect(result.suggestions).toEqual(['test'])
  })

  it('closes unclosed arrays', () => {
    const input = '{"keywords": ["test1"]'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result.keywords).toEqual(['test1'])
  })

  it('handles nested structures', () => {
    const input = '{"data": {"visibilityScore": 85}'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result.data.visibilityScore).toBe(85)
  })

  it('handles empty object', () => {
    const input = '{}'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result).toEqual({})
  })

  it('handles empty array', () => {
    const input = '[]'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result).toEqual([])
  })

  it('handles object with array', () => {
    const input = '{"visibilityScore": 85, "keywords": ["test"]}'
    const result = JSON.parse(repairTruncatedJson(input))
    expect(result.visibilityScore).toBe(85)
    expect(result.keywords).toEqual(['test'])
  })
})

describe('Model Provider Mapping', () => {
  const MODEL_PROVIDER_MAP: Record<string, string> = {
    default: 'gemini',
    'gemini-flash': 'gemini',
    'gpt-4o-mini': 'openrouter',
    'gpt-4o': 'openrouter',
    'claude-sonnet': 'openrouter',
    'llama-70b': 'groq',
    'mixtral-8x7b': 'groq',
    'llama-cerebras': 'cerebras',
  }

  it('maps gemini-flash to gemini', () => {
    expect(MODEL_PROVIDER_MAP['gemini-flash']).toBe('gemini')
  })

  it('maps gpt models to openrouter', () => {
    expect(MODEL_PROVIDER_MAP['gpt-4o-mini']).toBe('openrouter')
    expect(MODEL_PROVIDER_MAP['gpt-4o']).toBe('openrouter')
  })

  it('maps llama models to groq', () => {
    expect(MODEL_PROVIDER_MAP['llama-70b']).toBe('groq')
    expect(MODEL_PROVIDER_MAP['mixtral-8x7b']).toBe('groq')
  })

  it('maps cerebras models', () => {
    expect(MODEL_PROVIDER_MAP['llama-cerebras']).toBe('cerebras')
  })

  it('defaults to gemini', () => {
    expect(MODEL_PROVIDER_MAP['default']).toBe('gemini')
  })
})

describe('URL Content Extraction', () => {
  it('validates URL format', () => {
    const isValidUrl = (url: string): boolean => {
      try {
        new URL(url)
        return true
      } catch {
        return false
      }
    }

    expect(isValidUrl('https://example.com')).toBe(true)
    expect(isValidUrl('http://test.com/page')).toBe(true)
    expect(isValidUrl('not-a-url')).toBe(false)
    expect(isValidUrl('')).toBe(false)
  })

  it('extracts domain from URL', () => {
    const extractDomain = (url: string): string => {
      try {
        return new URL(url).hostname
      } catch {
        return ''
      }
    }

    expect(extractDomain('https://example.com/page')).toBe('example.com')
    expect(extractDomain('https://sub.example.com/path')).toBe('sub.example.com')
  })
})

describe('Content Sanitization', () => {
  const sanitizeContent = (html: string): string => {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  it('removes script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><span>World</span>'
    const result = sanitizeContent(input)
    expect(result).not.toContain('script')
    expect(result).toContain('Hello')
    expect(result).toContain('World')
  })

  it('removes style tags', () => {
    const input = '<p>Hello</p><style>body { display: none }</style><span>World</span>'
    const result = sanitizeContent(input)
    expect(result).not.toContain('style')
    expect(result).toContain('Hello')
    expect(result).toContain('World')
  })

  it('replaces HTML tags with spaces', () => {
    const input = '<div><p>Test</p></div>'
    const result = sanitizeContent(input)
    expect(result).toBe('Test')
  })

  it('collapses multiple whitespace', () => {
    const input = 'Hello    World   Test'
    const result = sanitizeContent(input)
    expect(result).toBe('Hello World Test')
  })

  it('trims result', () => {
    const input = '   Hello World   '
    const result = sanitizeContent(input)
    expect(result).toBe('Hello World')
  })
})

describe('Score Normalization', () => {
  const normalizeScore = (score: number): number => {
    return Math.min(100, Math.max(0, score))
  }

  it('keeps valid scores unchanged', () => {
    expect(normalizeScore(50)).toBe(50)
    expect(normalizeScore(0)).toBe(0)
    expect(normalizeScore(100)).toBe(100)
  })

  it('clamps negative values to 0', () => {
    expect(normalizeScore(-10)).toBe(0)
    expect(normalizeScore(-100)).toBe(0)
  })

  it('clamps values over 100 to 100', () => {
    expect(normalizeScore(150)).toBe(100)
    expect(normalizeScore(110)).toBe(100)
  })

  it('handles decimal values', () => {
    expect(normalizeScore(50.5)).toBe(50.5)
    expect(normalizeScore(99.9)).toBe(99.9)
  })
})
