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
// ║  FILE: workers/service-worker/src/auth.ts                        ║
// ║  LAYER: backend/src                                              ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import type { Env } from './index'

const OIDC_PROVIDER = 'https://accounts.google.com'
const REDIRECT_URI = 'https://api.headyconnection.org/oauth/callback'

/**
 * Handle all OAuth routes: login, callback, token refresh, and logout.
 */
export async function handleOAuth(request: Request, env?: Env): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname

  if (pathname === '/oauth/login') {
    return handleLogin(url, env!)
  }

  if (pathname === '/oauth/callback') {
    return handleCallback(url, env!)
  }

  if (pathname === '/oauth/token') {
    return handleTokenRefresh(request, env!)
  }

  if (pathname === '/oauth/logout') {
    return handleLogout(request, env!)
  }

  return new Response('Not Found', { status: 404 })
}

/**
 * Redirect user to OIDC provider for login.
 */
function handleLogin(url: URL, env: Env): Response {
  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.HEADY_OIDC_CLIENT_SECRET ? 'heady-client' : 'heady-default',
    redirect_uri: REDIRECT_URI,
    scope: 'openid email profile',
    state,
  })

  return Response.redirect(`${OIDC_PROVIDER}/o/oauth2/v2/auth?${params}`, 302)
}

/**
 * Handle the callback from the OIDC provider — exchange code for tokens.
 */
async function handleCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return jsonResponse({ error: 'OAuth provider error', details: error }, 400)
  }

  if (!code) {
    return jsonResponse({ error: 'Missing authorization code' }, 400)
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`${OIDC_PROVIDER}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: 'heady-client',
        client_secret: env.HEADY_OIDC_CLIENT_SECRET,
      }),
    })

    if (!tokenResponse.ok) {
      return jsonResponse({ error: 'Token exchange failed' }, 502)
    }

    const tokens = await tokenResponse.json() as Record<string, unknown>

    // Store session in KV
    const sessionId = crypto.randomUUID()
    await env.SESSIONS.put(sessionId, JSON.stringify({
      tokens,
      createdAt: new Date().toISOString(),
      state,
    }), { expirationTtl: 86400 }) // 24h TTL

    return jsonResponse({
      session_id: sessionId,
      token_type: 'Bearer',
      expires_in: tokens.expires_in,
    })
  } catch (err) {
    return jsonResponse({ error: 'Internal auth error' }, 500)
  }
}

/**
 * Refresh an access token using the stored refresh token.
 */
async function handleTokenRefresh(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as Record<string, string>
    const sessionId = body.session_id

    if (!sessionId) {
      return jsonResponse({ error: 'Missing session_id' }, 400)
    }

    const sessionData = await env.SESSIONS.get(sessionId)
    if (!sessionData) {
      return jsonResponse({ error: 'Session not found or expired' }, 401)
    }

    const session = JSON.parse(sessionData)
    const refreshToken = session.tokens?.refresh_token

    if (!refreshToken) {
      return jsonResponse({ error: 'No refresh token available' }, 400)
    }

    const tokenResponse = await fetch(`${OIDC_PROVIDER}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: 'heady-client',
        client_secret: env.HEADY_OIDC_CLIENT_SECRET,
      }),
    })

    if (!tokenResponse.ok) {
      return jsonResponse({ error: 'Token refresh failed' }, 502)
    }

    const newTokens = await tokenResponse.json()

    // Update session
    session.tokens = newTokens
    session.refreshedAt = new Date().toISOString()
    await env.SESSIONS.put(sessionId, JSON.stringify(session), { expirationTtl: 86400 })

    return jsonResponse({ refreshed: true, expires_in: (newTokens as Record<string, unknown>).expires_in })
  } catch (err) {
    return jsonResponse({ error: 'Token refresh error' }, 500)
  }
}

/**
 * Logout — delete the session from KV.
 */
async function handleLogout(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as Record<string, string>
    const sessionId = body.session_id

    if (sessionId) {
      await env.SESSIONS.delete(sessionId)
    }

    return jsonResponse({ logged_out: true })
  } catch {
    return jsonResponse({ error: 'Logout error' }, 500)
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
