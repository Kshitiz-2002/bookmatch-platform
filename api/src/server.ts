import http from "http";
import app from "./app";
import prisma from "./lib/prismaClient";
import redis from "./lib/redis";

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(app);

// Graceful shutdown helpers
async function shutdown(signal: string) {
  console.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(async (err) => {
    if (err) {
      console.error("Server close error", err);
      process.exit(1);
    }
    try {
      await prisma.$disconnect();
      try {
        if (redis && typeof redis.quit === "function") await redis.quit();
      } catch (redisErr) {
        console.warn("Error disconnecting redis:", redisErr);
      }
    } catch (dbErr) {
      console.warn("Error disconnecting DB:", dbErr);
    }
    console.info("Shutdown complete.");
    process.exit(0);
  });

  // Force exit if not closed in 30s
  setTimeout(() => {
    console.error("Shutdown timeout, forcing exit");
    process.exit(1);
  }, 30_000).unref();
}

// Start server
server.listen(PORT, () => {
  console.log(`BookMatch API server listening on port ${PORT} — pid=${process.pid}`);
});

// handle OS signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// export server for tests
export default server;
