import type { FastifyPluginAsync } from "fastify";
import {
  createGroupRequestSchema,
  groupIdParamsSchema,
  groupActivityQuerySchema,
  groupRankingQuerySchema,
  groupMemberParamsSchema,
  groupMembersQuerySchema,
  ownershipTransferRequestSchema,
  updateGroupRequestSchema,
  updateGroupPrivacyRequestSchema,
} from "@football/contracts";
import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import { GroupService } from "./group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { ApplicationError } from "../errors.js";
import { GroupRankingService } from "./group-ranking-service.js";
import { GroupInsightsService } from "./group-insights-service.js";

export function createGroupRoutes(
  auth: FootballAuth,
  players: PlayerService,
  groups: GroupService,
  rankings: GroupRankingService,
  insights: GroupInsightsService,
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

    app.post("/groups", async (request, reply) => {
      const player = await actor(request);
      const body = createGroupRequestSchema.parse(request.body);
      const group = await groups.create(player.id, body.name);
      return reply.status(201).send({
        id: group.id,
        name: group.name,
        status: group.status,
        visibility: group.visibility,
        role: group.role,
        capabilities: group.capabilities,
      });
    });
    app.get("/groups", async (request) =>
      groups.listForPlayer((await actor(request)).id),
    );
    app.get("/groups/:groupId", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      return groups.get((await actor(request)).id, groupId);
    });
    app.patch("/groups/:groupId", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const body = updateGroupRequestSchema.parse(request.body);
      return groups.rename((await actor(request)).id, groupId, body.name);
    });
    app.patch("/groups/:groupId/privacy", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const body = updateGroupPrivacyRequestSchema.parse(request.body);
      return groups.setVisibility(
        (await actor(request)).id,
        groupId,
        body.visibility,
      );
    });
    app.post("/groups/:groupId/archive", async (request, reply) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      await groups.archive((await actor(request)).id, groupId);
      return reply.status(204).send();
    });
    app.get("/groups/:groupId/members", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const query = groupMembersQuerySchema.parse(request.query);
      const rows = await groups.members(
        (await actor(request)).id,
        groupId,
        query.includeBlocked,
      );
      return rows.map((row) => ({
        id: row.id,
        role: row.role,
        capabilities: row.capabilities,
        status: row.status,
        joinedAt: row.joinedAt.toISOString(),
        player: { id: row.playerId, displayName: row.displayName },
      }));
    });
    app.get("/groups/:groupId/rankings/F5", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const query = groupRankingQuerySchema.parse(request.query);
      return rankings.list((await actor(request)).id, groupId, query);
    });
    app.get("/groups/:groupId/activity", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const query = groupActivityQuerySchema.parse(request.query);
      return insights.activity((await actor(request)).id, groupId, query);
    });
    app.get("/groups/:groupId/stats", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      return insights.stats((await actor(request)).id, groupId);
    });
    app.post(
      "/groups/:groupId/members/:playerId/promote",
      async (request, reply) => {
        const params = groupMemberParamsSchema.parse(request.params);
        await groups.changeModerator(
          (await actor(request)).id,
          params.groupId,
          params.playerId,
          "MODERATOR",
        );
        return reply.status(204).send();
      },
    );
    app.post(
      "/groups/:groupId/members/:playerId/demote",
      async (request, reply) => {
        const params = groupMemberParamsSchema.parse(request.params);
        await groups.changeModerator(
          (await actor(request)).id,
          params.groupId,
          params.playerId,
          "MEMBER",
        );
        return reply.status(204).send();
      },
    );
    app.post("/groups/:groupId/ownership-transfer", async (request, reply) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const { targetPlayerId } = ownershipTransferRequestSchema.parse(
        request.body,
      );
      await groups.transferOwnership(
        (await actor(request)).id,
        groupId,
        targetPlayerId,
      );
      return reply.status(204).send();
    });
    app.post("/groups/:groupId/leave", async (request, reply) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      await groups.leave((await actor(request)).id, groupId);
      return reply.status(204).send();
    });
    app.delete("/groups/:groupId/members/:playerId", async (request, reply) => {
      const params = groupMemberParamsSchema.parse(request.params);
      await groups.remove(
        (await actor(request)).id,
        params.groupId,
        params.playerId,
      );
      return reply.status(204).send();
    });
    return Promise.resolve();
  };
}
