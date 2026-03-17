// packages/heady-llm/src/embed.js
// §4 — Embedding with HuggingFace 3-Token Round-Robin
import { VECTOR_DIM } from '../../heady-core/src/phi.js';

const HF_TOKENS = [
  process.env.HF_TOKEN_1,
  process.env.HF_TOKEN_2,
  process.env.HF_TOKEN_3
].filter(Boolean);

let hfTokenIdx = 0;
const cooldowns = new Map(); // token → cooldown timestamp

/**
 * Get the next available HF token (round-robin with cooldown).
 * @returns {string}
 */
function nextToken() {
  const now = Date.now();
  for (let i = 0; i < HF_TOKENS.length; i++) {
    const idx = (hfTokenIdx + i) % HF_TOKENS.length;
    const token = HF_TOKENS[idx];
    const cd = cooldowns.get(token);
    if (!cd || now > cd) {
      hfTokenIdx = idx + 1;
      return token;
    }
  }
  // All tokens on cooldown — use first anyway
  hfTokenIdx++;
  return HF_TOKENS[0];
}

/**
 * Generate a 384-dim embedding for text via HuggingFace Inference API.
 * @param {string} text
 * @returns {Promise<number[]>} — 384-dimensional float array
 */
export async function getEmbedding(text) {
  if (!HF_TOKENS.length) {
    throw new Error('No HF_TOKEN_* environment variables configured');
  }

  const token = nextToken();
  const res = await fetch(
    'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: text })
    }
  );

  if (res.status === 429) {
    // Rate limited — cooldown this token for 60s
    cooldowns.set(token, Date.now() + 60_000);
    // Retry with next token
    const altToken = nextToken();
    const retry = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${altToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: text })
      }
    );
    if (!retry.ok) throw new Error(`HF embedding retry failed: ${retry.status}`);
    const data = await retry.json();
    return Array.isArray(data[0]) ? data[0] : data;
  }

  if (!res.ok) throw new Error(`HF embedding ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data[0]) ? data[0] : data; // 384D float array
}

/**
 * Generate embeddings for multiple texts in batch.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function getBatchEmbeddings(texts) {
  return Promise.all(texts.map(getEmbedding));
}
