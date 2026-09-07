import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";

import { ApplicationError } from "../errors.js";
import type { PlayerService } from "../identity/player-service.js";
import type { HomeService } from "./home-service.js";

export function createHomeRoutes(
  auth: FootballAuth,
  players: PlayerService,
  home: HomeService,
): FastifyPluginAsync {
  return (app) => {
    app.get("/me/home", async (request) => {
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
      return home.get(
        { id: player.id, displayName: player.displayName },
        (area) =>
          request.log.warn(
            { area, playerId: player.id },
            "home optional section unavailable",
          ),
      );
    });
    return Promise.resolve();
  };
}
