import { randomUUID } from "node:crypto";

import Fastify from "fastify";

import { createLoggerOptions } from "@football/observability";

import type { ApiConfig } from "./config.js";
import { registerHealthRoute } from "./http/health.js";

export function buildApp(config: ApiConfig) {
  const app = Fastify({
    genReqId: (request) => {
      const requestId = request.headers["x-request-id"];
      return typeof requestId === "string" && requestId.length > 0
        ? requestId
        : randomUUID();
    },
    logger: createLoggerOptions({ level: config.LOG_LEVEL, service: "api" }),
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "request failed");
    const isValidationError =
      typeof error === "object" && error !== null && "validation" in error;
    const statusCode = isValidationError ? 400 : 500;
    return reply.status(statusCode).send({
      error: statusCode === 400 ? "bad_request" : "internal_server_error",
      requestId: request.id,
    });
  });

  app.register(registerHealthRoute);
  return app;
}
