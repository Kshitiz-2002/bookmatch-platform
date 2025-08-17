import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BUCKET = process.env.SUPABASE_BUCKET || "books";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in env");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Server-side upload: accepts Buffer (fileBuffer) and uploads to bucket at objectKey.
 */
export async function uploadFile(objectKey: string, fileBuffer: Buffer) {
  const { error } = await supabase.storage.from(BUCKET).upload(objectKey, fileBuffer, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return { objectKey };
}

/**
 * Create a signed URL (download) for private buckets.
 */
export async function createSignedDownloadUrl(objectKey: string, expiresSec = 60 * 10) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectKey, expiresSec);
  if (error) throw error;
  return { url: data.signedUrl };
}

/**
 * Get public URL (for public buckets)
 */
export function getPublicUrl(objectKey: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);
  return { url: data.publicUrl };
}
