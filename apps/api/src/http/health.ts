import type { FastifyPluginCallback } from "fastify";

import { healthResponseSchema } from "@football/contracts";

export const registerHealthRoute: FastifyPluginCallback = (
  app,
  _options,
  done,
) => {
  app.get("/health", () => healthResponseSchema.parse({ status: "ok" }));
  done();
};
