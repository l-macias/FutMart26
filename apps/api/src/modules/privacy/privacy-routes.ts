import type { FastifyPluginAsync } from "fastify";

import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import {
  completeComplianceRequestSchema,
  updatePlayerPrivacyRequestSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { ComplianceService } from "./compliance-service.js";

export function createPrivacyRoutes(
  auth: FootballAuth,
  players: PlayerService,
  compliance: ComplianceService,
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
      const player = await players.provisionForCompliance(
        identity.authUserId,
        identity.displayName,
      );
      return { identity, player };
    }

    app.get("/me/compliance", async (request) => {
      const current = await actor(request);
      return compliance.status(current.identity.authUserId, current.player.id);
    });
    app.put("/me/compliance", async (request) => {
      const current = await actor(request);
      return compliance.complete(
        current.identity.authUserId,
        current.player.id,
        completeComplianceRequestSchema.parse(request.body),
      );
    });
    app.patch("/me/player/privacy", async (request) => {
      const current = await actor(request);
      if (current.player.accountStatus !== "ACTIVE")
        throw new ApplicationError(
          "account_anonymized",
          "Account is inactive",
          403,
        );
      const body = updatePlayerPrivacyRequestSchema.parse(request.body);
      return compliance.setPlayerVisibility(
        current.player.id,
        body.profileVisibility,
      );
    });
    return Promise.resolve();
  };
}
