import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

dotenv.config();

const PORT = process.env.PORT || 3000;

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY // use service key server-side
const supabase = createClient(supabaseUrl, supabaseKey);

// Upstash Redis (REST) client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

const app = express();
app.use(cors());
app.use(express.json());

/**
 * GET /api/v1/healthz
 */
app.get("/api/v1/healthz", (req, res) => res.json({ ok: true }));

/**
 * POST /api/v1/books/upload-url
 * Body: { fileName, contentType, size }
 * Returns presigned upload URL from Supabase Storage
 */
app.post("/api/v1/books/upload-url", async (req, res) => {
  const { fileName } = req.body;
  if (!fileName) return res.status(400).json({ error: "fileName required" });

  // create a path for the user, e.g. uploads/<userId>/<random>/<fileName>
  const objectKey = `uploads/${Date.now()}-${fileName}`;

  // Supabase: create signed upload URL (valid for 2 hours)
  const { data, error } = await supabase.storage
    .from("books")
    .createSignedUploadUrl(objectKey, 60 * 60 * 2); // seconds

  if (error) return res.status(500).json({ error: error.message });
  // return the signed url and objectKey to client
  return res.json({ uploadUrl: data?.signedUploadUrl, objectKey });
});

/**
 * POST /api/v1/books
 * Body: metadata including fileKey
 */
app.post("/api/v1/books", async (req, res) => {
  const { title, authors, description, fileKey, visibility = "public" } = req.body;
  if (!title || !fileKey) return res.status(400).json({ error: "title & fileKey required" });

  const { data, error } = await supabase
    .from("books")
    .insert({
      title,
      authors,
      description,
      file_key: fileKey,
      visibility
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // optionally cache or push event to redis
  await redis.set(`book:${data.id}`, JSON.stringify(data), { ex: 60 * 60 });

  return res.status(201).json({ book: data });
});

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
