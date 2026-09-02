import type { FastifyPluginAsync } from "fastify";

import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";

import { ApplicationError } from "../errors.js";
import { PlayerPerformanceReadService } from "../progression/player-performance-read-service.js";
import { PlayerService } from "./player-service.js";

export function createProfileRoutes(
  auth: FootballAuth,
  players: PlayerService,
  performances: PlayerPerformanceReadService,
): FastifyPluginAsync {
  return (app) => {
    app.get("/me/performance/F5", async (request) => {
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
      return performances.getF5(player.id);
    });
    return Promise.resolve();
  };
}
