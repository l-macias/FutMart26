import type { FastifyPluginAsync } from "fastify";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import {
  createCourtRequestSchema,
  createVenueRequestSchema,
  groupIdParamsSchema,
  venueIdParamsSchema,
  venueSearchQuerySchema,
} from "@football/contracts";

import { ApplicationError } from "../errors.js";
import { PlayerService } from "../identity/player-service.js";
import { VenueService } from "./venue-service.js";

export function createVenueRoutes(
  auth: FootballAuth,
  players: PlayerService,
  venues: VenueService,
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

    app.get("/venues", async (request) => {
      await actor(request);
      const query = venueSearchQuerySchema.parse(request.query);
      return venues.search(query.query, query.city, query.limit);
    });
    app.post("/groups/:groupId/venues", async (request, reply) => {
      const { groupId } = groupIdParamsSchema.parse(request.params);
      const body = createVenueRequestSchema.parse(request.body);
      return reply
        .status(201)
        .send(await venues.create((await actor(request)).id, groupId, body));
    });
    app.get("/venues/:venueId/courts", async (request) => {
      await actor(request);
      const { venueId } = venueIdParamsSchema.parse(request.params);
      return venues.courts(venueId);
    });
    app.post(
      "/groups/:groupId/venues/:venueId/courts",
      async (request, reply) => {
        const { groupId } = groupIdParamsSchema.parse(request.params);
        const { venueId } = venueIdParamsSchema.parse(request.params);
        const body = createCourtRequestSchema.parse(request.body);
        return reply
          .status(201)
          .send(
            await venues.createCourt(
              (await actor(request)).id,
              groupId,
              venueId,
              body.displayName,
            ),
          );
      },
    );
    return Promise.resolve();
  };
}
