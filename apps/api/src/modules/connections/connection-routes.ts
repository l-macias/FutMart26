import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import {
  connectionListQuerySchema,
  connectionRequestSchema,
  connectionRequestsQuerySchema,
  connectionTargetParamsSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { ConnectionService } from "./connection-service.js";

export function createConnectionRoutes(
  auth: FootballAuth,
  players: PlayerService,
  connections: ConnectionService,
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

    app.post("/me/connections/requests", async (request) => {
      const { playerId } = connectionRequestSchema.parse(request.body);
      return connections.request((await actor(request)).id, playerId);
    });
    app.get("/me/connections", async (request) => {
      const query = connectionListQuerySchema.parse(request.query);
      return connections.list((await actor(request)).id, query);
    });
    app.get("/me/connections/requests", async (request) => {
      const query = connectionRequestsQuerySchema.parse(request.query);
      return connections.listRequests(
        (await actor(request)).id,
        query.direction,
        query,
      );
    });
    app.get("/me/connections/:playerId/status", async (request) => {
      const { playerId } = connectionTargetParamsSchema.parse(request.params);
      return connections.status((await actor(request)).id, playerId);
    });
    app.post("/me/connections/:playerId/accept", async (request) => {
      const { playerId } = connectionTargetParamsSchema.parse(request.params);
      return connections.accept((await actor(request)).id, playerId);
    });
    app.post("/me/connections/:playerId/reject", async (request) => {
      const { playerId } = connectionTargetParamsSchema.parse(request.params);
      return connections.reject((await actor(request)).id, playerId);
    });
    app.delete("/me/connections/:playerId/request", async (request) => {
      const { playerId } = connectionTargetParamsSchema.parse(request.params);
      return connections.cancel((await actor(request)).id, playerId);
    });
    app.delete("/me/connections/:playerId", async (request) => {
      const { playerId } = connectionTargetParamsSchema.parse(request.params);
      return connections.remove((await actor(request)).id, playerId);
    });
    return Promise.resolve();
  };
}
