import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import { updatePlayerRequestSchema } from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "./player-service.js";
import { PlayerMediaService } from "../media/player-media-service.js";
import { ageOn } from "../privacy/compliance-service.js";

export function createPlayerRoutes(
  auth: FootballAuth,
  players: PlayerService,
  media?: PlayerMediaService,
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

    app.get("/me/player", async (request) => {
      const player = await actor(request);
      return {
        id: player.id,
        displayName: player.displayName,
        image: (await media?.getPlayerImage(player.id)) ?? null,
        dateOfBirth: player.dateOfBirth,
        age: player.dateOfBirth ? ageOn(player.dateOfBirth) : null,
        profileVisibility: player.profileVisibility,
        accountStatus: player.accountStatus,
      };
    });

    app.patch("/me/player", async (request) => {
      const input = updatePlayerRequestSchema.parse(request.body);
      const player = await actor(request);
      const updated = await players.updateDisplayName(
        player.id,
        input.displayName,
      );
      return {
        ...updated,
        image: (await media?.getPlayerImage(player.id)) ?? null,
        dateOfBirth: player.dateOfBirth,
        age: player.dateOfBirth ? ageOn(player.dateOfBirth) : null,
        profileVisibility: player.profileVisibility,
        accountStatus: player.accountStatus,
      };
    });

    return Promise.resolve();
  };
}
