// packages/heady-llm/src/reranker.js
// Jina Reranker v3 — SOTA 61.94 nDCG@10 on BEIR
// ~20 lines of real integration code

const JINA_API_KEY = process.env.JINA_API_KEY;

/**
 * Rerank documents using Jina Reranker v3.
 * Feed top-N retrieval results → rerank → return top-K.
 *
 * @param {string} query — the search query
 * @param {Array<{content: string, id?: string}>} documents — retrieved documents
 * @param {number} [topK=5] — number of results to return
 * @returns {Promise<Array<{content: string, id?: string, relevance_score: number}>>}
 */
export async function rerank(query, documents, topK = 5) {
  if (!JINA_API_KEY) {
    // Fallback: return documents in original order
    return documents.slice(0, topK).map((d, i) => ({
      ...d, relevance_score: 1 - (i / documents.length)
    }));
  }

  const res = await fetch('https://api.jina.ai/v1/rerank', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JINA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'jina-reranker-v3',
      query,
      documents: documents.map(d => typeof d === 'string' ? d : d.content),
      top_n: topK
    })
  });

  if (!res.ok) throw new Error(`Jina Reranker ${res.status}: ${await res.text()}`);
  const data = await res.json();

  return data.results.map(r => ({
    ...documents[r.index],
    relevance_score: r.relevance_score
  }));
}
