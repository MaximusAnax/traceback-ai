import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { buildServer } from "../server/fastify.js";
import { startMaintenanceWorker } from "../queue/workers/maintenance.worker.js";
import { redisConnection } from "../queue/connection.js";

const mode = process.argv[2];

const main = async (): Promise<void> => {
  if (mode === "server") {
    const app = await buildServer();
    await app.listen({ host: "0.0.0.0", port: env.PORT });
    logger.info({ port: env.PORT }, "traceback server started");
    return;
  }

  if (mode === "worker") {
    startMaintenanceWorker();
    logger.info("maintenance worker started");
    return;
  }

  logger.info("usage: tsx src/cli/index.ts [server|worker]");
  await redisConnection.quit();
  process.exitCode = 1;
};

main().catch(async (error) => {
  logger.error({ err: error }, "fatal startup error");
  await redisConnection.quit();
  process.exitCode = 1;
});
