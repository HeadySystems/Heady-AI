// packages/heady-guard/src/sign.js
// §9 — Ed25519 Trust Receipt Signing
import { createSign, createVerify } from 'crypto';

/**
 * Sign a pipeline output with Ed25519 to create a trust receipt.
 * Private key stored in GCP Secret Manager.
 *
 * @param {{ output: string, userId: string, sessionId: string, pipelineHash: string }} params
 * @returns {Promise<string>} — Trust receipt: heady:v1:{sessionId}:{signature}
 */
export async function signOutput(params) {
  const privateKey = await getSecretFromGCP('heady-ed25519-private-key');

  const payload = JSON.stringify({
    output: params.output.substring(0, 500),
    userId: params.userId,
    sessionId: params.sessionId,
    pipelineHash: params.pipelineHash,
    timestamp: Date.now()
  });

  const sign = createSign('SHA256');
  sign.update(payload);
  sign.end();
  const signature = sign.sign({ key: privateKey, format: 'pem' }, 'base64');

  return `heady:v1:${params.sessionId}:${signature}`;
}

/**
 * Verify a trust receipt from a previous pipeline run.
 * @param {string} receipt
 * @param {object} params
 * @returns {Promise<boolean>}
 */
export async function verifyReceipt(receipt, params) {
  const publicKey = await getSecretFromGCP('heady-ed25519-public-key');
  const [, , sessionId, signature] = receipt.split(':');

  const payload = JSON.stringify({
    output: params.output.substring(0, 500),
    userId: params.userId,
    sessionId,
    pipelineHash: params.pipelineHash,
    timestamp: params.timestamp
  });

  const verify = createVerify('SHA256');
  verify.update(payload);
  verify.end();
  return verify.verify({ key: publicKey, format: 'pem' }, signature, 'base64');
}

/**
 * Fetch a secret from GCP Secret Manager (or env var fallback).
 * @param {string} secretName
 * @returns {Promise<string>}
 */
async function getSecretFromGCP(secretName) {
  // Env var fallback
  const envKey = secretName.replace(/-/g, '_').toUpperCase();
  if (process.env[envKey]) return process.env[envKey];

  try {
    const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
      name: `projects/${process.env.GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`
    });
    return version.payload.data.toString();
  } catch (err) {
    throw new Error(`Secret ${secretName} not found: ${err.message}`);
  }
}
