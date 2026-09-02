import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import {
  directedInvitationParamsSchema,
  directedInvitationRequestSchema,
  groupDirectedInvitationParamsSchema,
  groupIdParamsSchema,
  matchDirectedInvitationParamsSchema,
  matchIdParamsSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { InvitationService } from "../groups/invitation-service.js";
import { PlayerService } from "../identity/player-service.js";
import { MatchInvitationService } from "../matches/match-invitation-service.js";
import { MatchService } from "../matches/match-service.js";

export function createDirectedInvitationRoutes(
  auth: FootballAuth,
  players: PlayerService,
  groups: InvitationService,
  matchInvitations: MatchInvitationService,
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

    app.post("/groups/:groupId/connection-invitations", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const { playerId } = directedInvitationRequestSchema.parse(request.body);
      return groups.createDirected(
        (await actor(request)).id,
        groupId,
        playerId,
      );
    });
    app.get("/groups/:groupId/connection-invitations", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      return groups.listDirectedForGroup((await actor(request)).id, groupId);
    });
    app.delete(
      "/groups/:groupId/connection-invitations/:invitationId",
      async (request, reply) => {
        const params = groupDirectedInvitationParamsSchema.parse(
          request.params,
        );
        await groups.revokeDirected(
          (await actor(request)).id,
          params.groupId,
          params.invitationId,
        );
        return reply.status(204).send();
      },
    );
    app.post("/matches/:matchId/invitations", async (request) => {
      const { matchId } = matchIdParamsSchema.parse(request.params);
      const { playerId } = directedInvitationRequestSchema.parse(request.body);
      return matchInvitations.create(
        (await actor(request)).id,
        matchId,
        playerId,
      );
    });
    app.delete(
      "/matches/:matchId/invitations/:invitationId",
      async (request, reply) => {
        const params = matchDirectedInvitationParamsSchema.parse(
          request.params,
        );
        await matchInvitations.revoke(
          (await actor(request)).id,
          params.matchId,
          params.invitationId,
        );
        return reply.status(204).send();
      },
    );
    app.get("/me/directed-invitations", async (request) => {
      const playerId = (await actor(request)).id;
      const [groupInvitations, matchInvitationItems] = await Promise.all([
        groups.listDirectedFor(playerId),
        matchInvitations.listFor(playerId),
      ]);
      return { groupInvitations, matchInvitations: matchInvitationItems };
    });
    app.post("/me/group-invitations/:invitationId/accept", async (request) => {
      const { invitationId } = directedInvitationParamsSchema.parse(
        request.params,
      );
      return groups.acceptDirected((await actor(request)).id, invitationId);
    });
    app.post(
      "/me/group-invitations/:invitationId/reject",
      async (request, reply) => {
        const { invitationId } = directedInvitationParamsSchema.parse(
          request.params,
        );
        await groups.rejectDirected((await actor(request)).id, invitationId);
        return reply.status(204).send();
      },
    );
    app.post("/me/match-invitations/:invitationId/accept", async (request) => {
      const { invitationId } = directedInvitationParamsSchema.parse(
        request.params,
      );
      return matches.acceptInvitation((await actor(request)).id, invitationId);
    });
    app.post(
      "/me/match-invitations/:invitationId/reject",
      async (request, reply) => {
        const { invitationId } = directedInvitationParamsSchema.parse(
          request.params,
        );
        await matchInvitations.reject((await actor(request)).id, invitationId);
        return reply.status(204).send();
      },
    );
    return Promise.resolve();
  };
}
