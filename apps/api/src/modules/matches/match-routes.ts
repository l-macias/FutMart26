import type { FastifyPluginAsync } from "fastify";

import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import {
  createGuestRequestSchema,
  createMatchRequestSchema,
  groupIdParamsSchema,
  matchGuestParamsSchema,
  matchIdParamsSchema,
  updateMatchRequestSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchService } from "./match-service.js";

export function createMatchRoutes(
  auth: FootballAuth,
  players: PlayerService,
  matches: MatchService,
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

    app.post("/groups/:groupId/matches", async (request, reply) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const body = createMatchRequestSchema.parse(request.body);
      const match = await matches.create((await actor(request)).id, groupId, {
        ...body,
        scheduledAt: new Date(body.scheduledAt),
      });
      return reply.status(201).send(match);
    });
    app.get("/groups/:groupId/matches", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      return matches.list((await actor(request)).id, groupId);
    });
    app.get("/matches/:matchId", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return matches.get((await actor(request)).id, matchId);
    });
    app.post("/matches/:matchId/publish", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      await matches.publish((await actor(request)).id, matchId);
      return reply.status(204).send();
    });
    app.patch("/matches/:matchId", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const body = updateMatchRequestSchema.parse(request.body);
      await matches.update((await actor(request)).id, matchId, {
        ...body,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      });
      return reply.status(204).send();
    });
    app.post("/matches/:matchId/cancel", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      await matches.cancel((await actor(request)).id, matchId);
      return reply.status(204).send();
    });
    app.post("/matches/:matchId/start", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      await matches.start((await actor(request)).id, matchId);
      return reply.status(204).send();
    });
    app.post("/matches/:matchId/join", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const participation = await matches.join(
        (await actor(request)).id,
        matchId,
      );
      return { id: participation.id, status: participation.status };
    });
    app.post("/matches/:matchId/leave", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      await matches.leave((await actor(request)).id, matchId);
      return reply.status(204).send();
    });
    app.post("/matches/:matchId/guests", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const body = createGuestRequestSchema.parse(request.body);
      const guest = await matches.addGuest(
        (await actor(request)).id,
        matchId,
        body.displayName,
      );
      return reply.status(201).send({ id: guest.id, status: guest.status });
    });
    app.delete("/matches/:matchId/guests/:guestId", async (request, reply) => {
      const { matchId, guestId } = matchGuestParamsSchema.parse(request.params);
      await matches.cancelGuest((await actor(request)).id, matchId, guestId);
      return reply.status(204).send();
    });
    app.get("/matches/:matchId/roster", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return matches.roster((await actor(request)).id, matchId);
    });
    return Promise.resolve();
  };
}
