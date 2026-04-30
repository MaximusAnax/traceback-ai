import Fastify from "fastify";
import fastifyRawBody from "fastify-raw-body";
import { registerSentryWebhook } from "./routes/sentry-webhook.js";
import { logger } from "../utils/logger.js";

export const buildServer = async () => {
  const app = Fastify({ logger: false });
  await app.register(fastifyRawBody, {
    field: "rawBody",
    global: false,
    encoding: false,
    runFirst: true,
  });
  app.get("/healthz", async () => ({ ok: true }));
  await registerSentryWebhook(app);

  app.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, "request failed");
    const message = error instanceof Error ? error.message : "unexpected error";
    reply.code(400).send({ error: message });
  });

  return app;
};
