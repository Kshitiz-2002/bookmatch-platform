// apps/api/src/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

dotenv.config();

const PORT = process.env.PORT ?? 3000;

/**
 * Validate required env vars early so TypeScript knows they exist afterwards.
 * We throw at startup if something is missing (safer for CI / production).
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL environment variable");

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_SERVICE_KEY) throw new Error("Missing SUPABASE_SERVICE_KEY environment variable");

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.warn("Upstash Redis URL/token not provided — continuing without Redis caching");
}

/**
 * Create clients (now that env vars are validated)
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let redis: Redis | null = null;
if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
  });
}

const app = express();
app.use(cors());
app.use(express.json());

/**
 * GET /api/v1/healthz
 */
app.get("/api/v1/healthz", (_, res) => res.json({ ok: true }));

/**
 * POST /api/v1/books/upload-url
 * Body: { fileName }
 * Return: { path, token } - use path+token with Supabase client uploadToSignedUrl on client
 */
app.post("/api/v1/books/upload-url", async (req, res) => {
  try {
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: "fileName required" });

    // create a path for the user (you will want to replace with real user ID later)
    const objectKey = `uploads/${Date.now()}-${fileName}`;

    // NOTE: createSignedUploadUrl takes (path, options?) in current supabase-js;
    // do NOT pass a numeric expires param here. It will return { data: { token, path }, error }.
    const { data, error } = await supabase.storage
      .from("books")
      .createSignedUploadUrl(objectKey);

    if (error) {
      console.error("createSignedUploadUrl error:", error);
      return res.status(500).json({ error: error.message ?? "Failed to create signed upload URL" });
    }

    // data contains `token` and `path`. Client should use supabase.storage.from('books').uploadToSignedUrl(path, token, file)
    return res.status(200).json({ path: data?.path, token: data?.token });
  } catch (err) {
    console.error("upload-url error:", err);
    return res.status(500).json({ error: (err as Error).message || "server error" });
  }
});

/**
 * POST /api/v1/books
 * Body: { title, authors, description, fileKey, visibility }
 */
app.post("/api/v1/books", async (req, res) => {
  try {
    const { title, authors, description, fileKey, visibility = "public" } = req.body;
    if (!title || !fileKey) return res.status(400).json({ error: "title & fileKey required" });

    // Using Supabase insert - service key server-side
    const { data, error } = await supabase
      .from("books")
      .insert({
        title,
        authors,
        description,
        file_key: fileKey,
        visibility,
      })
      .select()
      .single();

    if (error) {
      console.error("insert book error:", error);
      return res.status(500).json({ error: error.message ?? "Failed to create book" });
    }

    // optional: cache small representation in Redis (if configured)
    if (redis && data?.id) {
      try {
        await redis.set(`book:${data.id}`, JSON.stringify(data), { ex: 60 * 60 });
      } catch (redisErr) {
        console.warn("Redis set failed:", redisErr);
      }
    }

    return res.status(201).json({ book: data });
  } catch (err) {
    console.error("create book error:", err);
    return res.status(500).json({ error: (err as Error).message || "server error" });
  }
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
