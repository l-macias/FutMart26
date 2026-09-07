import type {
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  healthResponseSchema,
  readinessResponseSchema,
} from "@football/contracts";

import type { ReadinessService } from "../runtime/readiness.js";

export const registerHealthRoute: FastifyPluginCallback<{
  readiness: ReadinessService;
}> = (app, options, done) => {
  app.get("/health", () => healthResponseSchema.parse({ status: "ok" }));
  const readiness = async (_request: FastifyRequest, reply: FastifyReply) => {
    const snapshot = readinessResponseSchema.parse(
      await options.readiness.check(),
    );
    return reply.status(snapshot.status === "ready" ? 200 : 503).send(snapshot);
  };
  app.get("/ready", readiness);
  app.get("/readiness", readiness);
  done();
};
