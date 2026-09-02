import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import {
  playerSearchQuerySchema,
  publicPlayerParamsSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "./player-service.js";
import { PublicPlayerProfileService } from "./public-player-profile-service.js";

export function createPublicPlayerRoutes(
  auth: FootballAuth,
  players: PlayerService,
  profiles: PublicPlayerProfileService,
): FastifyPluginAsync {
  return (app) => {
    async function actor(request: { headers: NodeJS.Dict<string | string[]> }) {
      const identity = await resolveAuthIdentity(auth, request.headers);
      if (!identity)
        throw new ApplicationError(
          "unauthenticated",
          "Authentication required",
          401,
        );
      return players.provision(identity.authUserId, identity.displayName);
    }

    app.get("/players/search", async (request) => {
      const query = playerSearchQuerySchema.parse(request.query);
      return profiles.search((await actor(request)).id, query);
    });
    app.get("/players/:playerId/public-profile", async (request) => {
      const { playerId } = publicPlayerParamsSchema.parse(request.params);
      return profiles.get((await actor(request)).id, playerId);
    });
    return Promise.resolve();
  };
}
