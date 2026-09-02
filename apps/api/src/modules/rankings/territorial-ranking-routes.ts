import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import {
  cityRankingParamsSchema,
  countryRankingParamsSchema,
  provinceRankingParamsSchema,
  territorialRankingQuerySchema,
  venueRankingParamsSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { TerritorialRankingService } from "./territorial-ranking-service.js";

export function createTerritorialRankingRoutes(
  auth: FootballAuth,
  players: PlayerService,
  rankings: TerritorialRankingService,
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

    app.get("/rankings/venues/:venueId/F5", async (request) => {
      const { venueId } = venueRankingParamsSchema.parse(request.params);
      const query = territorialRankingQuerySchema.parse(request.query);
      return rankings.list(
        (await actor(request)).id,
        { type: "VENUE", venueId },
        query,
      );
    });
    app.get("/rankings/cities/:cityKey/F5", async (request) => {
      const { cityKey } = cityRankingParamsSchema.parse(request.params);
      const query = territorialRankingQuerySchema.parse(request.query);
      return rankings.list(
        (await actor(request)).id,
        { type: "CITY", cityKey },
        query,
      );
    });
    app.get("/rankings/provinces/:provinceKey/F5", async (request) => {
      const { provinceKey } = provinceRankingParamsSchema.parse(request.params);
      const query = territorialRankingQuerySchema.parse(request.query);
      return rankings.list(
        (await actor(request)).id,
        { type: "PROVINCE", provinceKey },
        query,
      );
    });
    app.get("/rankings/countries/:countryKey/F5", async (request) => {
      const { countryKey } = countryRankingParamsSchema.parse(request.params);
      const query = territorialRankingQuerySchema.parse(request.query);
      return rankings.list(
        (await actor(request)).id,
        { type: "COUNTRY", countryKey },
        query,
      );
    });
    return Promise.resolve();
  };
}
