import { describe, expect, it } from 'vitest'
import { createSiteAccess, SITE_ACCESS_COOKIE } from './siteAccess.js'

describe('site password access', () => {
  it('stays open when no server password is configured', () => {
    const access = createSiteAccess('')
    expect(access.required).toBe(false)
    expect(access.verifyPassword('anything')).toBe(true)
    expect(access.isAuthorized('')).toBe(true)
  })

  it('compares the configured password and never embeds it in the token', () => {
    const access = createSiteAccess('example-room-password')
    const token = access.issueToken(1_000)
    expect(access.verifyPassword('example-room-password')).toBe(true)
    expect(access.verifyPassword('wrong-password')).toBe(false)
    expect(token).not.toContain('example-room-password')
  })

  it('accepts a signed cookie until it expires', () => {
    const access = createSiteAccess('test-password', { ttlMs: 5_000 })
    const token = access.issueToken(10_000)
    const cookies = `theme=dark; ${SITE_ACCESS_COOKIE}=${encodeURIComponent(token)}; other=value`
    expect(access.isAuthorized(cookies, 14_999)).toBe(true)
    expect(access.isAuthorized(cookies, 15_000)).toBe(false)
    expect(access.isAuthorized(`${SITE_ACCESS_COOKIE}=${token}tampered`, 12_000)).toBe(false)
  })
})
