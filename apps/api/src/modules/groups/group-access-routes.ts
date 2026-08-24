import type { FastifyPluginAsync } from "fastify";
import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import {
  createGroupGuestRequestSchema,
  createInvitationRequestSchema,
  footballPreferencesRequestSchema,
  groupGuestListQuerySchema,
  groupGuestParamsSchema,
  groupIdParamsSchema,
  groupMemberParamsSchema,
  guestAllowanceRequestSchema,
  guestPolicyRequestSchema,
  invitationParamsSchema,
  invitationTokenParamsSchema,
  moderatorCapabilitiesRequestSchema,
  updateGroupGuestRequestSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { FootballPreferencesService } from "../identity/football-preferences-service.js";
import { PlayerService } from "../identity/player-service.js";
import { GroupGuestService } from "./group-guest-service.js";
import { GroupService } from "./group-service.js";
import { InvitationService } from "./invitation-service.js";

export function createGroupAccessRoutes(
  auth: FootballAuth,
  players: PlayerService,
  groups: GroupService,
  invitations: InvitationService,
  guests: GroupGuestService,
  preferences: FootballPreferencesService,
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

    app.get("/invitations/:token", async (request) => {
      const { token } = invitationTokenParamsSchema.parse(request.params);
      return invitations.preview(token);
    });
    app.post("/invitations/:token/join", async (request) => {
      const { token } = invitationTokenParamsSchema.parse(request.params);
      return invitations.join((await actor(request)).id, token);
    });
    app.post("/groups/:groupId/invitations", async (request, reply) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const input = createInvitationRequestSchema.parse(request.body);
      const created = await invitations.create(
        (await actor(request)).id,
        groupId,
        input.type === "SINGLE_USE"
          ? input
          : { ...input, expiresAt: new Date(input.expiresAt) },
      );
      return reply.status(201).send(created);
    });
    app.get("/groups/:groupId/invitations", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      return invitations.list((await actor(request)).id, groupId);
    });
    app.delete(
      "/groups/:groupId/invitations/:invitationId",
      async (request, reply) => {
        const params = invitationParamsSchema.parse(request.params);
        await invitations.revoke(
          (await actor(request)).id,
          params.groupId,
          params.invitationId,
        );
        return reply.status(204).send();
      },
    );
    app.get(
      "/groups/:groupId/invitations/:invitationId/usages",
      async (request) => {
        const params = invitationParamsSchema.parse(request.params);
        return invitations.usages(
          (await actor(request)).id,
          params.groupId,
          params.invitationId,
        );
      },
    );

    app.get("/me/football-preferences/F5", async (request) =>
      preferences.get((await actor(request)).id),
    );
    app.put("/me/football-preferences/F5", async (request) => {
      const input = footballPreferencesRequestSchema.parse(request.body);
      return preferences.put((await actor(request)).id, input);
    });

    app.get("/groups/:groupId/guests", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const query = groupGuestListQuerySchema.parse(request.query);
      return guests.list(
        (await actor(request)).id,
        groupId,
        query.limit,
        query.offset,
      );
    });
    app.post("/groups/:groupId/guests", async (request, reply) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const body = createGroupGuestRequestSchema.parse(request.body);
      return reply
        .status(201)
        .send(
          await guests.create(
            (await actor(request)).id,
            groupId,
            body.displayName,
          ),
        );
    });
    app.patch("/groups/:groupId/guests/:guestId", async (request, reply) => {
      const params = groupGuestParamsSchema.parse(request.params);
      const body = updateGroupGuestRequestSchema.parse(request.body);
      await guests.rename(
        (await actor(request)).id,
        params.groupId,
        params.guestId,
        body.displayName,
      );
      return reply.status(204).send();
    });
    app.post(
      "/groups/:groupId/guests/:guestId/archive",
      async (request, reply) => {
        const params = groupGuestParamsSchema.parse(request.params);
        await guests.archive(
          (await actor(request)).id,
          params.groupId,
          params.guestId,
        );
        return reply.status(204).send();
      },
    );
    app.post(
      "/groups/:groupId/guests/:guestId/restore",
      async (request, reply) => {
        const params = groupGuestParamsSchema.parse(request.params);
        await guests.restore(
          (await actor(request)).id,
          params.groupId,
          params.guestId,
        );
        return reply.status(204).send();
      },
    );
    app.delete("/groups/:groupId/guests/:guestId", async (request, reply) => {
      const params = groupGuestParamsSchema.parse(request.params);
      await guests.remove(
        (await actor(request)).id,
        params.groupId,
        params.guestId,
      );
      return reply.status(204).send();
    });
    app.get("/groups/:groupId/guest-policy", async (request) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      return guests.getPolicy((await actor(request)).id, groupId);
    });
    app.patch("/groups/:groupId/guest-policy", async (request, reply) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const body = guestPolicyRequestSchema.parse(request.body);
      await guests.updatePolicy((await actor(request)).id, groupId, body);
      return reply.status(204).send();
    });
    app.patch(
      "/groups/:groupId/members/:playerId/guest-allowance",
      async (request, reply) => {
        const params = groupMemberParamsSchema.parse(request.params);
        const body = guestAllowanceRequestSchema.parse(request.body);
        await guests.updateAllowance(
          (await actor(request)).id,
          params.groupId,
          params.playerId,
          body.guestAllowanceOverride,
        );
        return reply.status(204).send();
      },
    );
    app.post(
      "/groups/:groupId/members/:playerId/block",
      async (request, reply) => {
        const params = groupMemberParamsSchema.parse(request.params);
        await groups.block(
          (await actor(request)).id,
          params.groupId,
          params.playerId,
        );
        return reply.status(204).send();
      },
    );
    app.post(
      "/groups/:groupId/members/:playerId/unblock",
      async (request, reply) => {
        const params = groupMemberParamsSchema.parse(request.params);
        await groups.unblock(
          (await actor(request)).id,
          params.groupId,
          params.playerId,
        );
        return reply.status(204).send();
      },
    );
    app.patch(
      "/groups/:groupId/members/:playerId/capabilities",
      async (request, reply) => {
        const params = groupMemberParamsSchema.parse(request.params);
        const body = moderatorCapabilitiesRequestSchema.parse(request.body);
        await groups.setModeratorCapabilities(
          (await actor(request)).id,
          params.groupId,
          params.playerId,
          body.capabilities,
        );
        return reply.status(204).send();
      },
    );
    return Promise.resolve();
  };
}
