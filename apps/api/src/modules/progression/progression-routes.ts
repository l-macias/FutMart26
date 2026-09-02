import type { FastifyPluginAsync } from "fastify";

import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import {
  matchIdParamsSchema,
  progressionHistoryQuerySchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { ProgressionHistoryService } from "./progression-history-service.js";
import { ProgressionRevealService } from "./progression-reveal-service.js";

export function createProgressionRoutes(
  auth: FootballAuth,
  players: PlayerService,
  reveals: ProgressionRevealService,
  history: ProgressionHistoryService,
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

    app.get("/matches/:matchId/progression/reveal", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return reveals.get((await actor(request)).id, matchId);
    });
    app.post("/matches/:matchId/progression/materialize", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return reveals.materialize((await actor(request)).id, matchId);
    });
    app.get("/me/progression/history", async (request) => {
      const query = progressionHistoryQuerySchema.parse(request.query);
      return history.list((await actor(request)).id, query);
    });
    return Promise.resolve();
  };
}
