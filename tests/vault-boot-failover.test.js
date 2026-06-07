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
// ║  FILE: tests/vault-boot-failover.test.js                                                    ║
// ║  LAYER: tests                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Vault Boot Failover Tests v1.0.0                          ║
// ║  Validates GCP Secret Manager fallbacks for secure boot          ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder              ║
// ╚══════════════════════════════════════════════════════════════════╝

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock GCP Secret Manager Client
const mockAccessSecretVersion = vi.fn();
const mockGetProjectId = vi.fn().mockResolvedValue('test-project-123');

class MockSecretManagerServiceClient {
  constructor() {}
  getProjectId = mockGetProjectId;
  accessSecretVersion = mockAccessSecretVersion;
}

// Mock SecureKeyVault
const mockUnlock = vi.fn();
const mockGet = vi.fn();

// Inject mocks into require.cache for CommonJS compatibility
const secureKeyVaultPath = require.resolve('../src/services/secure-key-vault');
require.cache[secureKeyVaultPath] = {
  id: secureKeyVaultPath,
  filename: secureKeyVaultPath,
  loaded: true,
  exports: {
    vault: {
      unlock: mockUnlock,
      get: mockGet,
    },
  },
};

const gcpSMPath = require.resolve('@google-cloud/secret-manager');
require.cache[gcpSMPath] = {
  id: gcpSMPath,
  filename: gcpSMPath,
  loaded: true,
  exports: {
    SecretManagerServiceClient: MockSecretManagerServiceClient,
  },
};

// Import the service under test
const { bootVault } = require('../src/services/vault-boot');

describe('Vault Boot Failover Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetProjectId.mockResolvedValue('test-project-123');
    // Clear environment variables we test with
    delete process.env.VAULT_PASSPHRASE;
    delete process.env.GCP_PROJECT_ID;
    delete process.env.GCLOUD_PROJECT_ID;
    delete process.env.HEADY_API_KEY;
    delete process.env.GITHUB_TOKEN;
  });

  test('Case 1: Local vault is unlocked and contains the secret', async () => {
    process.env.VAULT_PASSPHRASE = 'valid-passphrase';
    mockUnlock.mockResolvedValue(true);
    mockGet.mockImplementation((key) => {
      if (key === 'heady-api-key') {
        return { value: 'local-vault-value' };
      }
      return { value: 'local-dummy-value' };
    });

    const result = await bootVault();

    expect(result.ok).toBe(true);
    expect(process.env.HEADY_API_KEY).toBe('local-vault-value');
    expect(mockUnlock).toHaveBeenCalledWith('valid-passphrase');
    expect(mockAccessSecretVersion).not.toHaveBeenCalled();
  });

  test('Case 2: Local vault is locked or missing keys, fall back to GCP Secret Manager', async () => {
    // Local vault unlock fails
    process.env.VAULT_PASSPHRASE = 'invalid-passphrase';
    mockUnlock.mockRejectedValue(new Error('Decrypt failed'));

    // Mock Secret Manager returning payload
    mockAccessSecretVersion.mockImplementation(({ name }) => {
      if (name.includes('heady-heady-api-key') || name.includes('heady-api-key')) {
        return [{ payload: { data: Buffer.from('gcp-secret-value') } }];
      }
      throw new Error('Not found');
    });

    const result = await bootVault();

    expect(result.ok).toBe(true);
    expect(process.env.HEADY_API_KEY).toBe('gcp-secret-value');
    expect(mockAccessSecretVersion).toHaveBeenCalled();
  });

  test('Case 3: Unlocked but missing credential key locally, resolved via GCP Secret Manager', async () => {
    process.env.VAULT_PASSPHRASE = 'valid-passphrase';
    mockUnlock.mockResolvedValue(true);
    mockGet.mockResolvedValue(null); // Local vault doesn't have it

    mockAccessSecretVersion.mockImplementation(({ name }) => {
      if (name.includes('github-pat-primary') || name.includes('github-token')) {
        return [{ payload: { data: Buffer.from('github-gcp-value') } }];
      }
      throw new Error('Not found');
    });

    const result = await bootVault();

    expect(result.ok).toBe(true);
    expect(process.env.GITHUB_TOKEN).toBe('github-gcp-value');
  });
});
