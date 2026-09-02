import type { FastifyPluginAsync } from "fastify";

import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import { createAbuseReportRequestSchema } from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { AbuseReportService } from "./abuse-report-service.js";

export function createAbuseReportRoutes(
  auth: FootballAuth,
  players: PlayerService,
  reports: AbuseReportService,
): FastifyPluginAsync {
  return (app) => {
    app.post("/reports", async (request, reply) => {
      const identity = await resolveAuthIdentity(auth, request.headers);
      if (!identity)
        throw new ApplicationError(
          "unauthenticated",
          "Authentication required",
          401,
        );
      const player = await players.provision(
        identity.authUserId,
        identity.displayName,
      );
      const report = await reports.create(
        player.id,
        createAbuseReportRequestSchema.parse(request.body),
      );
      return reply.status(201).send(report);
    });
    return Promise.resolve();
  };
}
