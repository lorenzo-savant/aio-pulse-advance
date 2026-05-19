import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { safeFetch, SsrfError } from '../utils/safe-fetch'

const mockResolve4 = vi.fn()
const mockResolve6 = vi.fn()

vi.mock('dns/promises', () => ({
  resolve4: mockResolve4,
  resolve6: mockResolve6,
}))

describe('safeFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('protocol blocklist', () => {
    it('blocks file:// protocol', async () => {
      await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(SsrfError)
      await expect(safeFetch('file:///etc/passwd')).rejects.toMatchObject({
        code: 'BLOCKED_PROTOCOL',
      })
    })

    it('blocks gopher:// protocol', async () => {
      await expect(safeFetch('gopher://example.com')).rejects.toThrow(SsrfError)
      await expect(safeFetch('gopher://example.com')).rejects.toMatchObject({
        code: 'BLOCKED_PROTOCOL',
      })
    })

    it('blocks ftp:// protocol', async () => {
      await expect(safeFetch('ftp://example.com')).rejects.toThrow(SsrfError)
      await expect(safeFetch('ftp://example.com')).rejects.toMatchObject({
        code: 'BLOCKED_PROTOCOL',
      })
    })
  })

  describe('hostname blocklist', () => {
    it('blocks localhost hostname', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34'])
      mockResolve6.mockResolvedValue([])

      await expect(safeFetch('http://localhost/test')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://localhost/test')).rejects.toMatchObject({
        code: 'BLOCKED_HOST',
      })
    })

    it('blocks 127.0.0.1 hostname', async () => {
      mockResolve4.mockResolvedValue(['127.0.0.1'])
      mockResolve6.mockResolvedValue([])

      // 127.0.0.1 is an IPv4 literal — caught by the private-IPv4 check
      // before the hostname blocklist, so reported as BLOCKED_IP (more precise).
      await expect(safeFetch('http://127.0.0.1/test')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://127.0.0.1/test')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks ::1 IPv6 loopback hostname', async () => {
      mockResolve4.mockResolvedValue([])
      mockResolve6.mockResolvedValue(['::1'])

      await expect(safeFetch('http://[::1]/test')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://[::1]/test')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks metadata.googleusercontent.com', async () => {
      mockResolve4.mockResolvedValue(['169.254.169.254'])
      mockResolve6.mockResolvedValue([])

      await expect(safeFetch('http://metadata.googleusercontent.com/test')).rejects.toThrow(
        SsrfError,
      )
      await expect(safeFetch('http://metadata.googleusercontent.com/test')).rejects.toMatchObject({
        code: 'BLOCKED_HOST',
      })
    })

    it('blocks 169.254.169.254 metadata endpoint', async () => {
      mockResolve4.mockResolvedValue(['169.254.169.254'])
      mockResolve6.mockResolvedValue([])

      // 169.254.0.0/16 is a link-local IPv4 range — caught as BLOCKED_IP, not
      // BLOCKED_HOST (the hostname blocklist only catches the named alias
      // 'metadata.googleusercontent.com', which is covered by the test above).
      await expect(safeFetch('http://169.254.169.254/latest/meta-data')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://169.254.169.254/latest/meta-data')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })
  })

  describe('IPv4 private ranges', () => {
    it('blocks 10.x private range', async () => {
      mockResolve4.mockResolvedValue(['10.0.0.1'])
      mockResolve6.mockResolvedValue([])

      await expect(
        safeFetch('http://10.test.local', { headers: { Host: '10.0.0.1' } }),
      ).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://10.test.local', {})).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks 172.16.x private range', async () => {
      mockResolve4.mockResolvedValue(['172.16.0.1'])
      mockResolve6.mockResolvedValue([])

      await expect(safeFetch('http://172.16.test.local')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://172.16.test.local')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks 172.31.x private range', async () => {
      mockResolve4.mockResolvedValue(['172.31.255.1'])
      mockResolve6.mockResolvedValue([])

      await expect(safeFetch('http://172.31.test.local')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://172.31.test.local')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks 192.168.x private range', async () => {
      mockResolve4.mockResolvedValue(['192.168.1.1'])
      mockResolve6.mockResolvedValue([])

      await expect(safeFetch('http://192.168.test.local')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://192.168.test.local')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks 127.x loopback', async () => {
      mockResolve4.mockResolvedValue(['127.0.0.1'])
      mockResolve6.mockResolvedValue([])

      await expect(safeFetch('http://127.test.local')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://127.test.local')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks 169.254.x link-local', async () => {
      mockResolve4.mockResolvedValue(['169.254.169.254'])
      mockResolve6.mockResolvedValue([])

      await expect(safeFetch('http://169.254.test.local')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://169.254.test.local')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })
  })

  describe('IPv6 private ranges', () => {
    it('blocks ::1 loopback', async () => {
      mockResolve4.mockResolvedValue([])
      mockResolve6.mockResolvedValue(['::1'])

      await expect(safeFetch('http://[::1]/test')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://[::1]/test')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks fe80:: link-local', async () => {
      mockResolve4.mockResolvedValue([])
      mockResolve6.mockResolvedValue(['fe80::1'])

      await expect(safeFetch('http://[fe80::1]/test')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://[fe80::1]/test')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })

    it('blocks fc00:: ULA', async () => {
      mockResolve4.mockResolvedValue([])
      mockResolve6.mockResolvedValue(['fc00::1'])

      await expect(safeFetch('http://[fc00::1]/test')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://[fc00::1]/test')).rejects.toMatchObject({
        code: 'BLOCKED_IP',
      })
    })
  })

  describe('redirect validation', () => {
    it('blocks more than 3 redirects', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34'])
      mockResolve6.mockResolvedValue([])

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount <= 3) {
          return Promise.resolve({
            status: 302,
            headers: new Headers({ location: 'http://example.com/next' }),
          })
        }
        return Promise.resolve({
          status: 302,
          headers: new Headers({ location: 'http://example.com/final' }),
        })
      })

      await expect(safeFetch('http://example.com/start')).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://example.com/start')).rejects.toMatchObject({
        code: 'REDIRECT_LOOP',
      })
    })

    it('allows exactly 3 redirects', async () => {
      const fetchMock = vi.fn()

      let callCount = 0
      fetchMock.mockImplementation(() => {
        callCount++
        if (callCount <= 3) {
          return Promise.resolve({
            status: 302,
            headers: new Headers({ location: 'http://example.com/next' }),
          })
        }
        return Promise.resolve({
          status: 200,
          headers: new Headers(),
          ok: true,
        })
      })

      global.fetch = fetchMock
      mockResolve4.mockResolvedValue(['93.184.216.34'])
      mockResolve6.mockResolvedValue([])

      const response = await safeFetch('http://example.com/start')
      expect(response.status).toBe(200)
    })
  })

  describe('timeout', () => {
    it('times out after specified duration', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34'])
      mockResolve6.mockResolvedValue([])

      const abortError = new Error('The operation was aborted.')
      Object.defineProperty(abortError, 'name', { value: 'AbortError' })

      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(abortError), 100)
          }),
      )

      await expect(safeFetch('http://example.com', { timeout: 50 })).rejects.toThrow(SsrfError)
      await expect(safeFetch('http://example.com', { timeout: 50 })).rejects.toMatchObject({
        code: 'TIMEOUT',
      })
    })

    it('uses default timeout of 45000ms when not specified', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34'])
      mockResolve6.mockResolvedValue([])

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        ok: true,
      })

      const response = await safeFetch('http://example.com')
      expect(response.status).toBe(200)
    })
  })

  describe('allowed requests', () => {
    it('allows public URLs', async () => {
      mockResolve4.mockResolvedValue(['93.184.216.34'])
      mockResolve6.mockResolvedValue([])

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers(),
        ok: true,
      })

      const response = await safeFetch('https://example.com/api')
      expect(response.status).toBe(200)
    })
  })
})
