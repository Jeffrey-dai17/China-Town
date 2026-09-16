import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const SITE_ACCESS_COOKIE = 'csuboardgame_access'
export const SITE_ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000

function digest(value) {
  return createHash('sha256').update(value).digest()
}

function safeEqual(left, right) {
  return timingSafeEqual(digest(left), digest(right))
}

function readCookie(cookieHeader, name) {
  for (const part of String(cookieHeader || '').split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

export function createSiteAccess(password, { ttlMs = SITE_ACCESS_TTL_MS } = {}) {
  const secret = typeof password === 'string' ? password : ''
  const required = secret.length > 0

  function verifyPassword(candidate) {
    return !required || safeEqual(String(candidate ?? ''), secret)
  }

  function signature(expiresAt) {
    return createHmac('sha256', secret)
      .update(`csuboardgame-access:${expiresAt}`)
      .digest('base64url')
  }

  function issueToken(now = Date.now()) {
    if (!required) return ''
    const expiresAt = now + ttlMs
    return `${expiresAt}.${signature(expiresAt)}`
  }

  function verifyToken(token, now = Date.now()) {
    if (!required) return true
    const [expiresRaw, suppliedSignature, extra] = String(token || '').split('.')
    const expiresAt = Number(expiresRaw)
    if (extra !== undefined || !Number.isSafeInteger(expiresAt) || expiresAt <= now || !suppliedSignature) return false
    return safeEqual(suppliedSignature, signature(expiresAt))
  }

  function isAuthorized(cookieHeader, now = Date.now()) {
    return !required || verifyToken(readCookie(cookieHeader, SITE_ACCESS_COOKIE), now)
  }

  return {
    required,
    ttlMs,
    verifyPassword,
    issueToken,
    verifyToken,
    isAuthorized,
  }
}
