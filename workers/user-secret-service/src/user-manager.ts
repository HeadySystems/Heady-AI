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
// ║  FILE: workers/user-secret-service/src/user-manager.ts           ║
// ║  LAYER: backend/src                                              ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import type { Env } from './index'

interface UserSecret {
  secret: string
  updated: string
  metadata?: Record<string, string>
}

interface UserSecretCollection {
  secrets: UserSecret[]
  userId: string
  loadedAt: string
}

/**
 * Load all secrets for a given user from KV storage.
 * Returns a structured collection with metadata.
 */
export async function loadUserSecrets(
  env: Env,
  userId: string
): Promise<UserSecretCollection> {
  const raw = await env.USER_SECRETS.get(userId)

  if (!raw) {
    return { secrets: [], userId, loadedAt: new Date().toISOString() }
  }

  try {
    const parsed = JSON.parse(raw)

    // Normalize: single secret object or array
    const secrets: UserSecret[] = Array.isArray(parsed)
      ? parsed
      : [parsed]

    return {
      secrets,
      userId,
      loadedAt: new Date().toISOString(),
    }
  } catch {
    return { secrets: [], userId, loadedAt: new Date().toISOString() }
  }
}

/**
 * Store a secret for a user, appending to existing secrets.
 */
export async function storeUserSecret(
  env: Env,
  userId: string,
  secret: string,
  metadata?: Record<string, string>
): Promise<void> {
  const existing = await loadUserSecrets(env, userId)

  existing.secrets.push({
    secret,
    updated: new Date().toISOString(),
    metadata,
  })

  await env.USER_SECRETS.put(userId, JSON.stringify(existing.secrets))
}

/**
 * Delete all secrets for a user.
 */
export async function deleteUserSecrets(
  env: Env,
  userId: string
): Promise<boolean> {
  try {
    await env.USER_SECRETS.delete(userId)
    return true
  } catch {
    return false
  }
}
