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
  finalRosterRequestSchema,
  updateStatsRequestSchema,
  assignObserverRequestSchema,
  replaceMatchTeamsRequestSchema,
  resultDraftRequestSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchService } from "./match-service.js";
import { MatchCompletionService } from "./match-completion-service.js";
import { MatchResultService } from "./match-result-service.js";
import { MatchTeamService } from "./match-team-service.js";

export function createMatchRoutes(
  auth: FootballAuth,
  players: PlayerService,
  matches: MatchService,
  completion: MatchCompletionService,
  teams: MatchTeamService,
  results: MatchResultService,
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
        body.groupGuestId,
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
    app.get("/matches/:matchId/teams", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return teams.get((await actor(request)).id, matchId);
    });
    app.put("/matches/:matchId/teams", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const body = replaceMatchTeamsRequestSchema.parse(request.body);
      return teams.replace(
        (await actor(request)).id,
        matchId,
        body.assignments,
      );
    });
    app.post("/matches/:matchId/teams/generate", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return teams.generate((await actor(request)).id, matchId);
    });
    app.post("/matches/:matchId/finish", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      await completion.finish((await actor(request)).id, matchId);
      return reply.status(204).send();
    });
    app.put("/matches/:matchId/final-roster", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const body = finalRosterRequestSchema.parse(request.body);
      await completion.confirmRoster(
        (await actor(request)).id,
        matchId,
        body.participants,
      );
      return reply.status(204).send();
    });
    app.get("/matches/:matchId/final-roster", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return completion.getFinalRoster((await actor(request)).id, matchId);
    });
    app.put("/matches/:matchId/stats", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const body = updateStatsRequestSchema.parse(request.body);
      await completion.updateStats(
        (await actor(request)).id,
        matchId,
        body.participants,
      );
      return reply.status(204).send();
    });
    app.get("/matches/:matchId/stats", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return completion.getStats((await actor(request)).id, matchId);
    });
    app.get("/matches/:matchId/result", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return results.get((await actor(request)).id, matchId);
    });
    app.put("/matches/:matchId/result", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const body = resultDraftRequestSchema.parse(request.body);
      return results.saveDraft((await actor(request)).id, matchId, body);
    });
    app.post("/matches/:matchId/result/confirm", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return results.confirm((await actor(request)).id, matchId);
    });
    app.put("/matches/:matchId/observer", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const body = assignObserverRequestSchema.parse(request.body);
      await completion.assignObserver(
        (await actor(request)).id,
        matchId,
        body.playerId,
      );
      return reply.status(204).send();
    });
    app.delete("/matches/:matchId/observer", async (request, reply) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      await completion.removeObserver((await actor(request)).id, matchId);
      return reply.status(204).send();
    });
    app.get("/matches/:matchId/voting-eligibility", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      return completion.eligibility((await actor(request)).id, matchId);
    });
    return Promise.resolve();
  };
}
