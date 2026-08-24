import type { FastifyPluginAsync } from "fastify";

import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import {
  matchIdParamsSchema,
  submitBallotRequestSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { VotingService } from "./voting-service.js";

export function createVotingRoutes(
  auth: FootballAuth,
  players: PlayerService,
  voting: VotingService,
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

    app.post("/matches/:matchId/voting/open", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return voting.open((await actor(request)).id, matchId);
    });
    app.get("/matches/:matchId/voting", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return voting.get((await actor(request)).id, matchId);
    });
    app.post("/matches/:matchId/voting/ballot", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const body = submitBallotRequestSchema.parse(request.body);
      const result = await voting.submit(
        (await actor(request)).id,
        matchId,
        body,
      );
      return reply.status(201).send(result);
    });
    app.get("/matches/:matchId/voting/my-ballot", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return voting.myBallot((await actor(request)).id, matchId);
    });
    return Promise.resolve();
  };
}
