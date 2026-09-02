import type { FastifyPluginCallback } from "fastify";

import {
  healthResponseSchema,
  readinessResponseSchema,
} from "@football/contracts";

import type { ReadinessService } from "../runtime/readiness.js";

export const registerHealthRoute: FastifyPluginCallback<{
  readiness: ReadinessService;
}> = (app, options, done) => {
  app.get("/health", () => healthResponseSchema.parse({ status: "ok" }));
  app.get("/ready", async (_request, reply) => {
    const snapshot = readinessResponseSchema.parse(
      await options.readiness.check(),
    );
    return reply.status(snapshot.status === "ready" ? 200 : 503).send(snapshot);
  });
  done();
};
