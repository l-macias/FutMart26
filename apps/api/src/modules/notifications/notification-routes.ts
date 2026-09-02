import type { FastifyPluginAsync } from "fastify";

import type { FootballAuth } from "@football/auth";
import { resolveAuthIdentity } from "@football/auth";
import {
  notificationListQuerySchema,
  notificationParamsSchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { NotificationService } from "./notification-service.js";

export function createNotificationRoutes(
  auth: FootballAuth,
  players: PlayerService,
  notifications: NotificationService,
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

    app.get("/me/notifications", async (request) => {
      const query = notificationListQuerySchema.parse(request.query);
      return notifications.list((await actor(request)).id, query);
    });
    app.get("/me/notifications/unread-count", async (request) =>
      notifications.unreadCount((await actor(request)).id),
    );
    app.post("/me/notifications/:notificationId/read", async (request) => {
      const { notificationId } = notificationParamsSchema.parse(request.params);
      return notifications.markRead((await actor(request)).id, notificationId);
    });
    return Promise.resolve();
  };
}
