// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: workers/gateway-worker/src/middleware.ts                   ║
// ║  LAYER: backend/src                                              ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import type { Env } from './index'

interface AuthResult {
  valid: boolean
  userId: string
  roles: string[]
  error?: string
}

/**
 * Authorize an incoming request by validating the JWT bearer token
 * or API key from the Authorization header.
 */
export async function authorize(request: Request, env: Env): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization') || ''

  // API key auth (x-api-key header or Bearer prefix)
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) {
    return validateApiKey(apiKey, env)
  }

  // Bearer token auth
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    return validateJwt(token, env)
  }

  return { valid: false, userId: '', roles: [], error: 'No credentials provided' }
}

/**
 * Validate a JWT token using the HMAC-SHA256 secret.
 * Cloudflare Workers use the Web Crypto API.
 */
async function validateJwt(token: string, env: Env): Promise<AuthResult> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { valid: false, userId: '', roles: [], error: 'Malformed JWT' }
    }

    const [headerB64, payloadB64, signatureB64] = parts

    // Import the signing key
    const encoder = new TextEncoder()
    const keyData = encoder.encode(env.HEADY_JWT_SECRET)
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )

    // Verify signature
    const signedContent = encoder.encode(`${headerB64}.${payloadB64}`)
    const signature = base64UrlDecode(signatureB64)
    const valid = await crypto.subtle.verify('HMAC', cryptoKey, signature, signedContent)

    if (!valid) {
      return { valid: false, userId: '', roles: [], error: 'Invalid signature' }
    }

    // Decode payload
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, userId: '', roles: [], error: 'Token expired' }
    }

    return {
      valid: true,
      userId: payload.sub || payload.userId || '',
      roles: payload.roles || ['user'],
    }
  } catch (err) {
    return { valid: false, userId: '', roles: [], error: 'JWT validation failed' }
  }
}

/**
 * Validate an API key using timing-safe comparison.
 */
async function validateApiKey(key: string, env: Env): Promise<AuthResult> {
  const encoder = new TextEncoder()
  const a = encoder.encode(key)
  const b = encoder.encode(env.HEADY_JWT_SECRET)

  if (a.byteLength !== b.byteLength) {
    return { valid: false, userId: '', roles: [], error: 'Invalid API key' }
  }

  // Timing-safe comparison via Web Crypto
  const keyA = await crypto.subtle.importKey('raw', a, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const keyB = await crypto.subtle.importKey('raw', b, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const dummy = encoder.encode('heady-timing-safe-check')
  const sigA = await crypto.subtle.sign('HMAC', keyA, dummy)
  const sigB = await crypto.subtle.sign('HMAC', keyB, dummy)

  const viewA = new Uint8Array(sigA)
  const viewB = new Uint8Array(sigB)
  let match = viewA.length === viewB.length ? 1 : 0
  for (let i = 0; i < viewA.length; i++) {
    match &= viewA[i] === viewB[i] ? 1 : 0
  }

  if (match) {
    return { valid: true, userId: 'api-key-user', roles: ['admin'] }
  }
  return { valid: false, userId: '', roles: [], error: 'Invalid API key' }
}

/**
 * Decode a base64url string to an ArrayBuffer.
 */
function base64UrlDecode(str: string): ArrayBuffer {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}
