import axios from 'axios';

export async function getEmbeddingIfConfigured(text: string): Promise<number[]|null> {
  if (!text) return null;
  const endpoint = process.env.EMBEDDING_ENDPOINT || null;
  const hfToken = process.env.HF_TOKEN || null;

  if (endpoint) {
    // call local embedding service
    try {
      const resp = await axios.post(`${endpoint}/embed`, { text });
      return resp.data.embedding;
    } catch (e) {
      console.warn('embedding endpoint error', e);
      return null;
    }
  }

  if (hfToken) {
    try {
      const resp = await axios.post(
        'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
        text,
        { headers: { Authorization: `Bearer ${hfToken}` } }
      );
      // HF returns array of token vectors or pooled vector depending on pipeline; if nested, average
      if (Array.isArray(resp.data) && Array.isArray(resp.data[0])) {
        // average token vectors into single vector
        const tokens = resp.data as number[][];
        const dim = tokens[0].length;
        const avg = new Array(dim).fill(0);
        for (const t of tokens) for (let i=0;i<dim;i++) avg[i]+=t[i];
        for (let i=0;i<dim;i++) avg[i] /= tokens.length;
        return avg;
      } else if (Array.isArray(resp.data)) {
        return resp.data as number[];
      }
    } catch (e) {
      console.warn('HF embedding failed', e);
      return null;
    }
  }

  return null;
}
