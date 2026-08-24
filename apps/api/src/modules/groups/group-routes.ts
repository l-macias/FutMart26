import type { FastifyPluginAsync } from "fastify";
import {
  createGroupRequestSchema,
  groupIdParamsSchema,
  groupMemberParamsSchema,
  ownershipTransferRequestSchema,
} from "@football/contracts";
import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import { GroupService } from "./group-service.js";
import { PlayerService } from "../identity/player-service.js";
import { ApplicationError } from "../errors.js";

export function createGroupRoutes(
  auth: FootballAuth,
  players: PlayerService,
  groups: GroupService,
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
      return { id: player.id, displayName: player.displayName };
    });
    app.post("/groups", async (request, reply) => {
      const player = await actor(request);
      const body = createGroupRequestSchema.parse(request.body);
      const group = await groups.create(player.id, body.name);
      return reply.status(201).send({
        id: group.id,
        name: group.name,
        status: group.status,
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
    app.get("/groups/:groupId/members", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const rows = await groups.members((await actor(request)).id, groupId);
      return rows.map((row) => ({
        id: row.id,
        role: row.role,
        capabilities: row.capabilities,
        status: row.status,
        joinedAt: row.joinedAt.toISOString(),
        player: { id: row.playerId, displayName: row.displayName },
      }));
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
