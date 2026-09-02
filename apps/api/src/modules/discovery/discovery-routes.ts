import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import {
  discoveryQuerySchema,
  globalRankingQuerySchema,
  globalSearchQuerySchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { GlobalRankingService } from "../rankings/global-ranking-service.js";
import { DiscoveryService } from "./discovery-service.js";

export function createDiscoveryRoutes(
  auth: FootballAuth,
  players: PlayerService,
  globalRankings: GlobalRankingService,
  discovery: DiscoveryService,
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

    app.get("/rankings/global/F5", async (request) => {
      const query = globalRankingQuerySchema.parse(request.query);
      return globalRankings.list((await actor(request)).id, query);
    });
    app.get("/discovery/players/featured", async (request) => {
      const query = discoveryQuerySchema.parse(request.query);
      await actor(request);
      return discovery.featuredPlayers(query.period, query.limit);
    });
    app.get("/discovery/players/rising", async (request) => {
      const query = discoveryQuerySchema.parse(request.query);
      await actor(request);
      return discovery.risingPlayers(query.period, query.limit);
    });
    app.get("/discovery/groups/featured", async (request) => {
      const query = discoveryQuerySchema.parse(request.query);
      await actor(request);
      return discovery.featuredGroups(query.period, query.limit);
    });
    app.get("/search", async (request) => {
      const query = globalSearchQuerySchema.parse(request.query);
      return discovery.search((await actor(request)).id, query);
    });
    return Promise.resolve();
  };
}
