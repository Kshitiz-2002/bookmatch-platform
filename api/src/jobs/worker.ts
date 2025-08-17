import prisma from "../prisma/client";
import { log } from "../utils/logger";

/**
 * Simple polling worker skeleton that processes ModelJob rows.
 * In production you would trigger training with a job queue or cron.
 */

async function sleep(ms = 2000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(jobId: string) {
  log.info("Processing model job:", jobId);
  await prisma.modelJob.update({ where: { id: jobId }, data: { status: "running" } });

  try {
    // Placeholder: run training (call Python trainer or run internal code).
    // For demo we simulate training and write a metrics object.
    await sleep(3000);
    const metrics = { rmse: 0.92, trainedAt: new Date().toISOString() };

    // Save metrics and mark done
    await prisma.modelJob.update({ where: { id: jobId }, data: { status: "done", metrics } });

    // TODO: write recommendations into Recommendation table (piecewise)
    log.info("Model job done:", jobId);
  } catch (err) {
    log.error("Job failed:", jobId, err);
    await prisma.modelJob.update({ where: { id: jobId }, data: { status: "failed" } });
  }
}

async function loop() {
  log.info("Worker started");
  while (true) {
    try {
      const job = await prisma.modelJob.findFirst({ where: { status: "pending" }, orderBy: { createdAt: "asc" } });
      if (job) {
        await processJob(job.id);
      } else {
        await sleep(5000);
      }
    } catch (err) {
      log.error("Worker loop error", err);
      await sleep(5000);
    }
  }
}

loop().catch((err) => {
  log.error("Worker crashed:", err);
  process.exit(1);
});
