import { randomUUID } from "node:crypto";

import Fastify from "fastify";
import { ZodError } from "zod";

import type { FootballAuth } from "@football/auth";
import { createAuthNodeHandler } from "@football/auth";
import type { Database } from "@football/database";
import { createLoggerOptions } from "@football/observability";

import type { ApiConfig } from "./config.js";
import { registerHealthRoute } from "./http/health.js";
import { ApplicationError } from "./modules/errors.js";
import { createGroupRoutes } from "./modules/groups/group-routes.js";
import { GroupService } from "./modules/groups/group-service.js";
import { createGroupAccessRoutes } from "./modules/groups/group-access-routes.js";
import { GroupGuestService } from "./modules/groups/group-guest-service.js";
import { InvitationService } from "./modules/groups/invitation-service.js";
import { FootballPreferencesService } from "./modules/identity/football-preferences-service.js";
import { PlayerService } from "./modules/identity/player-service.js";
import { createMatchRoutes } from "./modules/matches/match-routes.js";
import { MatchService } from "./modules/matches/match-service.js";
import { MatchCompletionService } from "./modules/matches/match-completion-service.js";
import { MatchResultService } from "./modules/matches/match-result-service.js";
import { MatchTeamService } from "./modules/matches/match-team-service.js";
import { createVotingRoutes } from "./modules/voting/voting-routes.js";
import { VotingService } from "./modules/voting/voting-service.js";

export function buildApp(
  config: ApiConfig,
  dependencies: { auth: FootballAuth; database: Database },
) {
  const app = Fastify({
    genReqId: (request) => {
      const requestId = request.headers["x-request-id"];
      return typeof requestId === "string" && requestId.length > 0
        ? requestId
        : randomUUID();
    },
    logger: createLoggerOptions({ level: config.LOG_LEVEL, service: "api" }),
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "request failed");
    const isValidationError =
      error instanceof ZodError ||
      (typeof error === "object" && error !== null && "validation" in error);
    let databaseError: unknown = error;
    while (
      typeof databaseError === "object" &&
      databaseError !== null &&
      !("code" in databaseError) &&
      "cause" in databaseError
    ) {
      databaseError = databaseError.cause;
    }
    const constraint =
      typeof databaseError === "object" &&
      databaseError !== null &&
      "constraint_name" in databaseError
        ? String(databaseError.constraint_name)
        : undefined;
    const databaseCode =
      typeof databaseError === "object" &&
      databaseError !== null &&
      "code" in databaseError
        ? String(databaseError.code)
        : undefined;
    const databaseConflict = databaseCode === "23505";
    const statusCode =
      error instanceof ApplicationError
        ? error.statusCode
        : databaseConflict
          ? 409
          : isValidationError
            ? 400
            : 500;
    return reply.status(statusCode).send({
      error:
        error instanceof ApplicationError
          ? error.code
          : constraint === "group_memberships_active_player_uq"
            ? "already_member"
            : constraint === "group_memberships_active_owner_uq"
              ? "ownership_invariant_violation"
              : constraint === "match_participants_active_player_uq"
                ? "already_joined"
                : databaseConflict
                  ? "concurrency_conflict"
                  : statusCode === 400
                    ? "bad_request"
                    : "internal_server_error",
      requestId: request.id,
      ...(error instanceof ApplicationError && error.details
        ? { details: error.details }
        : {}),
    });
  });

  const trustedOrigins = new Set([config.WEB_URL, config.ADMIN_URL]);
  app.addHook("onRequest", (request, reply) => {
    const origin = request.headers.origin;
    if (!origin || !trustedOrigins.has(origin)) return;

    reply.header("access-control-allow-origin", origin);
    reply.header("access-control-allow-credentials", "true");
    reply.header("vary", "Origin");
    if (request.method === "OPTIONS") {
      reply.header(
        "access-control-allow-methods",
        "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      reply.header("access-control-allow-headers", "Content-Type");
      return reply.status(204).send();
    }
  });
  app.addHook("preHandler", (request) => {
    if (
      ["GET", "HEAD", "OPTIONS"].includes(request.method) ||
      request.url.startsWith("/api/auth/")
    )
      return;
    const origin = request.headers.origin;
    if (origin && !trustedOrigins.has(origin)) {
      throw new ApplicationError("forbidden", "Untrusted request origin", 403);
    }
  });

  app.register(registerHealthRoute);
  const authHandler = createAuthNodeHandler(dependencies.auth);
  app.all("/api/auth/*", {
    onRequest: async (request, reply) => {
      reply.hijack();
      await authHandler(request.raw, reply.raw);
    },
    handler: () => Promise.resolve(undefined),
  });
  app.register(
    createGroupRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new GroupService(dependencies.database),
    ),
  );
  app.register(
    createGroupAccessRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new GroupService(dependencies.database),
      new InvitationService(dependencies.database),
      new GroupGuestService(dependencies.database),
      new FootballPreferencesService(dependencies.database),
    ),
  );
  app.register(
    createMatchRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new MatchService(dependencies.database),
      new MatchCompletionService(dependencies.database),
      new MatchTeamService(dependencies.database),
      new MatchResultService(dependencies.database),
    ),
  );
  app.register(
    createVotingRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new VotingService(dependencies.database),
    ),
  );
  return app;
}
