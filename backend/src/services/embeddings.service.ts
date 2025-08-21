// src/services/embeddings.service.ts
import axios from "axios";

const HF_TOKEN = process.env.HF_TOKEN || null;
const EMBEDDING_ENDPOINT = process.env.EMBEDDING_ENDPOINT || null;
const HF_EMBEDDING_MODEL =
  process.env.HF_EMBEDDING_MODEL || "sentence-transformers/all-MiniLM-L6-v2";

const EMBEDDING_PROVIDER = (process.env.EMBEDDING_PROVIDER || "local").toLowerCase(); // 'local' | 'hf'
const LOCAL_EMBEDDING_MODEL =
  process.env.LOCAL_EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";
const MIN_EMBED_DIM = Number(process.env.MIN_EMBED_DIM || 16);

// Optional local cache dir for @xenova/transformers:
const TRANSFORMERS_CACHE = process.env.TRANSFORMERS_CACHE || "./models";

/* ---------------- helpers ---------------- */
function isNumberArray(a: any): a is number[] {
  return Array.isArray(a) && a.length > 0 && typeof a[0] === "number";
}
function isNestedNumberArray(a: any): a is number[][] {
  return Array.isArray(a) && Array.isArray(a[0]) && typeof a[0][0] === "number";
}

/** extract embedding vector if present and looks valid (various API shapes) */
function extractEmbedding(data: any): number[] | null {
  if (!data) return null;
  if (isNumberArray(data) && data.length >= MIN_EMBED_DIM) return data;
  if (isNestedNumberArray(data) && data[0].length >= MIN_EMBED_DIM) return data[0];
  if (data?.embedding && isNumberArray(data.embedding) && data.embedding.length >= MIN_EMBED_DIM) return data.embedding;
  if (Array.isArray(data?.data) && Array.isArray(data.data[0]?.embedding) && data.data[0].embedding.length >= MIN_EMBED_DIM) return data.data[0].embedding;
  if (Array.isArray(data) && data[0]?.embedding && isNumberArray(data[0].embedding) && data[0].embedding.length >= MIN_EMBED_DIM) return data[0].embedding;
  return null;
}

/** returns true if this response looks like similarity scores for payload.sentences */
function looksLikeSimilarityScores(respData: any, payload: any): boolean {
  try {
    const sentences = payload?.sentences ?? payload?.inputs?.sentences ?? null;
    if (!Array.isArray(sentences)) return false;
    if (Array.isArray(respData) && typeof respData[0] === "number" && respData.length === sentences.length) {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/* ---------------- local (transformers.js) ---------------- */
type LocalExtractor = {
  (text: string, opts?: any): Promise<any>;
};
let extractorPromise: Promise<LocalExtractor> | null = null;

async function getLocalExtractor(): Promise<LocalExtractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const mod: any = await import("@xenova/transformers");
      const { pipeline, env } = mod;

      // Prefer local cache directory; allow loading cached weights
      env.allowLocalModels = true;
      env.localModelPath = TRANSFORMERS_CACHE;
      env.cacheDir = TRANSFORMERS_CACHE;
      // Quantized weights keep memory small, great for CPU
      const extractor: LocalExtractor = await pipeline("feature-extraction", LOCAL_EMBEDDING_MODEL, {
        quantized: true,
      });
      return extractor;
    })();
  }
  return extractorPromise;
}

async function embedLocally(text: string): Promise<number[] | null> {
  try {
    const extractor = await getLocalExtractor();
    // Mean pool + L2 normalize to match sentence-transformers usage
    const output = await extractor(text, { pooling: "mean", normalize: true });

    // transformers.js often returns a Float32Array in .data, or a number[] directly
    const data: unknown = (output as any)?.data ?? output;

    // If it's already a number[] and valid, return
    if (isNumberArray(data) && (data as number[]).length >= MIN_EMBED_DIM) {
      return data as number[];
    }

    // If it's a nested array like [[...numbers...]]
    if (Array.isArray(data) && Array.isArray((data as any)[0]) && isNumberArray((data as any)[0])) {
      const nested = (data as any)[0] as number[];
      return nested.length >= MIN_EMBED_DIM ? nested : null;
    }

    // Otherwise try to coerce iterable-like data (Float32Array, TypedArray, etc.) -> number[]
    if (data != null && (Array.isArray(data) || typeof (data as any)[Symbol.iterator] === "function")) {
      const arr: number[] = Array.from(data as Iterable<unknown>).map((v: unknown) => Number(v)).filter((n) => Number.isFinite(n));
      return arr.length >= MIN_EMBED_DIM ? arr : null;
    }

    return null;
  } catch (err: any) {
    console.warn("Local embedding failed:", err?.message ?? err);
    return null;
  }
}


/* ---------------- HF HTTP helper ---------------- */
async function callHF(hfUrl: string, payload: any) {
  const resp = await axios.post(hfUrl, payload, {
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  return resp.data;
}

/* ---------------- HF embedding (fallback/alt) ---------------- */
async function embedViaHF(text: string): Promise<number[] | null> {
  if (!HF_TOKEN) return null;

  const hfBase = `https://api-inference.huggingface.co`;
  const hfModelUrl = `${hfBase}/models/${HF_EMBEDDING_MODEL}`;

  // Try a few payload variants
  const payloads = [
    { inputs: text },
    { inputs: [text] },
    { inputs: { source_sentence: text, sentences: [text] } }, // may yield similarity scores
  ];

  for (const p of payloads) {
    try {
      const data = await callHF(hfModelUrl, p);

      // If similarity scores, force feature-extraction task on same endpoint
      if (looksLikeSimilarityScores(data, p)) {
        try {
          const forced = await callHF(hfModelUrl, {
            inputs: [text],
            parameters: { task: "feature-extraction" },
            options: { wait_for_model: true },
          });
          const emb = extractEmbedding(forced);
          if (emb) return emb;
        } catch (forcedErr: any) {
          // fall through to try next payload
          console.warn("HF forced feature-extraction failed:", forcedErr?.response?.status ?? forcedErr?.message ?? forcedErr);
        }
        continue;
      }

      const emb = extractEmbedding(data);
      if (emb) return emb;

    } catch (err: any) {
      const status = err?.response?.status;
      const body = err?.response?.data;
      const msg = typeof body === "string" ? body : body?.error ?? body?.message ?? JSON.stringify(body ?? {}).slice(0, 200);

      // auth/not-found -> bail
      if ([401, 403, 404].includes(status)) {
        console.warn("HF model/token problem:", status, msg);
        return null;
      }
      // 400 -> try other payloads
      if (status === 400) {
        console.debug("HF returned 400 for payload, trying next. msg:", msg);
        continue;
      }
      // other/network -> try next
      console.warn("HF attempt failed, trying next:", err?.message ?? err, { status, msg });
      continue;
    }
  }

  console.warn("HF: no usable embedding returned after all payloads.");
  return null;
}

/* ---------------- main exported function ---------------- */
export async function getEmbeddingIfConfigured(text: string): Promise<number[] | null> {
  if (!text) return null;

  // 0) optional custom endpoint (if you add one later)
  if (EMBEDDING_ENDPOINT) {
    try {
      const resp = await axios.post(
        `${EMBEDDING_ENDPOINT.replace(/\/$/, "")}/embed`,
        { input: text },
        { headers: { "Content-Type": "application/json" } }
      );
      const emb = extractEmbedding(resp.data);
      if (emb) return emb;
      console.warn("Custom embedding endpoint returned non-vector shape:", resp.data);
    } catch (err: any) {
      console.warn("Custom embedding endpoint error:", err?.message ?? err);
    }
    // continue to provider path if custom fails
  }

  // 1) provider: local (default)
  if (EMBEDDING_PROVIDER === "local") {
    const localEmb = await embedLocally(text);
    if (localEmb) return localEmb;

    // graceful fallback to HF if token present
    if (HF_TOKEN) {
      console.debug("Local embedding failed — falling back to HF.");
      const hfEmb = await embedViaHF(text);
      if (hfEmb) return hfEmb;
    }
    return null;
  }

  // 2) provider: hf
  if (EMBEDDING_PROVIDER === "hf") {
    const hfEmb = await embedViaHF(text);
    if (hfEmb) return hfEmb;
    return null;
  }

  // Unknown provider
  console.warn(`Unknown EMBEDDING_PROVIDER='${EMBEDDING_PROVIDER}'.`);
  return null;
}
