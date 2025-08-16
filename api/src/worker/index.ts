import { Worker } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const connection = new IORedis(REDIS_URL);

console.log("Starting recs worker (recs-train) using", REDIS_URL);

const worker = new Worker(
  "recs-train",
  async (job) => {
    console.log("Run training job", job.id, job.data);
    // run your training logic here
    return await runTrainer(job.data);
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed`, err);
});

async function runTrainer(data: any) {
  await new Promise((r) => setTimeout(r, 3000));
  return { status: "ok", trainedAt: new Date().toISOString(), params: data };
}
