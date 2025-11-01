import { buildApp } from "./app";
import { env } from "./env";

const fastify = buildApp();

fastify
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then(() => {
    fastify.log.info(`Server started on port ${env.PORT}`);
  })
  .catch((error) => {
    fastify.log.error(error, "Failed to start server");
    process.exit(1);
  });
