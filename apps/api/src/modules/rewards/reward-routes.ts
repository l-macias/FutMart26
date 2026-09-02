import type { FastifyPluginAsync } from "fastify";

import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { RewardService } from "./reward-service.js";

export function createRewardRoutes(
  auth: FootballAuth,
  players: PlayerService,
  rewards: RewardService,
): FastifyPluginAsync {
  return (app) => {
    app.get("/me/rewards", async (request) => {
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
      return rewards.list(player.id);
    });
    return Promise.resolve();
  };
}
