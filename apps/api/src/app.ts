import { randomUUID } from "node:crypto";

import Fastify from "fastify";
import { ZodError } from "zod";

import {
  fromNodeHeaders,
  resolveAuthIdentity,
  type FootballAuth,
} from "@football/auth";
import type { Database } from "@football/database";
import { createLoggerOptions } from "@football/observability";

import type { ApiConfig } from "./config.js";
import { registerHealthRoute } from "./http/health.js";
import { ApplicationError } from "./modules/errors.js";
import { createConnectionRoutes } from "./modules/connections/connection-routes.js";
import { ConnectionService } from "./modules/connections/connection-service.js";
import { createGroupRoutes } from "./modules/groups/group-routes.js";
import { GroupService } from "./modules/groups/group-service.js";
import { GroupRankingService } from "./modules/groups/group-ranking-service.js";
import { GroupInsightsService } from "./modules/groups/group-insights-service.js";
import { createGroupAccessRoutes } from "./modules/groups/group-access-routes.js";
import { GroupGuestService } from "./modules/groups/group-guest-service.js";
import { InvitationService } from "./modules/groups/invitation-service.js";
import { FootballPreferencesService } from "./modules/identity/football-preferences-service.js";
import { PlayerService } from "./modules/identity/player-service.js";
import { createPlayerRoutes } from "./modules/identity/player-routes.js";
import { createPublicPlayerRoutes } from "./modules/identity/public-player-routes.js";
import { PublicPlayerProfileService } from "./modules/identity/public-player-profile-service.js";
import { createProfileRoutes } from "./modules/identity/profile-routes.js";
import { PlayerPerformanceReadService } from "./modules/progression/player-performance-read-service.js";
import { ProgressionHistoryService } from "./modules/progression/progression-history-service.js";
import { createProgressionRoutes } from "./modules/progression/progression-routes.js";
import { ProgressionRevealService } from "./modules/progression/progression-reveal-service.js";
import { ProgressionService } from "./modules/progression/progression-service.js";
import { createMatchRoutes } from "./modules/matches/match-routes.js";
import { MatchInvitationService } from "./modules/matches/match-invitation-service.js";
import { MatchService } from "./modules/matches/match-service.js";
import { MatchCompletionService } from "./modules/matches/match-completion-service.js";
import { MatchResultService } from "./modules/matches/match-result-service.js";
import { MatchTeamService } from "./modules/matches/match-team-service.js";
import { createNotificationRoutes } from "./modules/notifications/notification-routes.js";
import { NotificationService } from "./modules/notifications/notification-service.js";
import { createRewardRoutes } from "./modules/rewards/reward-routes.js";
import { RewardService } from "./modules/rewards/reward-service.js";
import { createTerritorialRankingRoutes } from "./modules/rankings/territorial-ranking-routes.js";
import { TerritorialRankingService } from "./modules/rankings/territorial-ranking-service.js";
import { createVotingRoutes } from "./modules/voting/voting-routes.js";
import { VotingService } from "./modules/voting/voting-service.js";
import { createVenueRoutes } from "./modules/venues/venue-routes.js";
import { VenueService } from "./modules/venues/venue-service.js";
import { createDirectedInvitationRoutes } from "./modules/invitations/directed-invitation-routes.js";
import { MatchRecruitmentService } from "./modules/matches/match-recruitment-service.js";
import { createDiscoveryRoutes } from "./modules/discovery/discovery-routes.js";
import { DiscoveryService } from "./modules/discovery/discovery-service.js";
import { GlobalRankingService } from "./modules/rankings/global-ranking-service.js";
import { createMediaRoutes } from "./modules/media/media-routes.js";
import { PlayerMediaService } from "./modules/media/player-media-service.js";
import type { StorageProvider } from "./modules/media/storage-provider.js";
import { UnavailableStorageProvider } from "./modules/media/storage-provider.js";
import { ComplianceService } from "./modules/privacy/compliance-service.js";
import { createPrivacyRoutes } from "./modules/privacy/privacy-routes.js";
import { AbuseReportService } from "./modules/privacy/abuse-report-service.js";
import { createAbuseReportRoutes } from "./modules/privacy/abuse-report-routes.js";
import { AdminService } from "./modules/admin/admin-service.js";
import { createAdminRoutes } from "./modules/admin/admin-routes.js";
import { ReadinessService } from "./runtime/readiness.js";

export function buildApp(
  config: ApiConfig,
  dependencies: {
    auth: FootballAuth;
    database: Database;
    storage?: StorageProvider;
  },
) {
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    genReqId: (request) => {
      const requestId = request.headers["x-request-id"];
      return typeof requestId === "string" && requestId.length > 0
        ? requestId
        : randomUUID();
    },
    logger: createLoggerOptions({ level: config.LOG_LEVEL, service: "api" }),
  });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header(
      "permissions-policy",
      "camera=(), microphone=(), geolocation=()",
    );
    reply.header(
      "content-security-policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    if (config.NODE_ENV === "production")
      reply.header(
        "strict-transport-security",
        "max-age=31536000; includeSubDomains",
      );
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
  // Fastify distinguishes promise-style hooks from callback hooks by `async`.
  app.addHook("onRequest", async (request, reply) => {
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
  // eslint-disable-next-line @typescript-eslint/require-await
  app.addHook("preHandler", async (request) => {
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

  const storage = dependencies.storage ?? new UnavailableStorageProvider();
  const readiness = new ReadinessService(
    dependencies.database,
    config,
    storage,
  );
  app.register(registerHealthRoute, { readiness });
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const authHeaders = {
        ...request.headers,
        "x-client-ip": request.ip,
      };
      const authResponse = await dependencies.auth.handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(authHeaders),
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        }),
      );
      for (const [name, value] of authResponse.headers) {
        if (name !== "set-cookie") reply.header(name, value);
      }
      const cookies = authResponse.headers.getSetCookie();
      if (cookies.length > 0) reply.header("set-cookie", cookies);
      return reply
        .status(authResponse.status)
        .send(Buffer.from(await authResponse.arrayBuffer()));
    },
  });
  const playerService = new PlayerService(dependencies.database);
  const mediaService = new PlayerMediaService(dependencies.database, storage, {
    warn: (metadata, message) => app.log.warn(metadata, message),
  });
  const complianceService = new ComplianceService(dependencies.database);
  const adminService = new AdminService(dependencies.database, mediaService);
  app.addHook("preHandler", async (request) => {
    const path = request.url.split("?", 1)[0] ?? request.url;
    if (path.startsWith("/api/auth/") || path.startsWith("/admin/")) return;
    const identity = await resolveAuthIdentity(
      dependencies.auth,
      request.headers,
    );
    if (!identity) return;
    if (await adminService.isSuspended(identity.authUserId))
      throw new ApplicationError(
        "account_suspended",
        "Account access is suspended",
        403,
      );
    if (path === "/me/compliance") return;
    const player = await playerService.provisionForCompliance(
      identity.authUserId,
      identity.displayName,
    );
    const compliance = await complianceService.status(
      identity.authUserId,
      player.id,
    );
    if (compliance.state === "READY") return;
    if (
      compliance.state === "FOOTBALL_PROFILE_REQUIRED" &&
      ["/me/football-preferences/F5", "/me/player"].includes(path)
    )
      return;
    throw new ApplicationError(
      "compliance_required",
      "Account compliance is required before using product surfaces",
      403,
      { state: compliance.state },
    );
  });
  app.register(
    createPlayerRoutes(dependencies.auth, playerService, mediaService),
  );
  app.register(
    createMediaRoutes(dependencies.auth, playerService, mediaService),
  );
  app.register(
    createPrivacyRoutes(dependencies.auth, playerService, complianceService),
  );
  app.register(
    createAbuseReportRoutes(
      dependencies.auth,
      playerService,
      new AbuseReportService(dependencies.database),
    ),
  );
  app.register(
    createAdminRoutes(
      dependencies.auth,
      dependencies.database,
      adminService,
      config,
      readiness,
    ),
  );
  app.register(
    createGroupRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new GroupService(dependencies.database),
      new GroupRankingService(dependencies.database),
      new GroupInsightsService(dependencies.database),
    ),
  );
  app.register(
    createProfileRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new PlayerPerformanceReadService(dependencies.database),
    ),
  );
  const publicPlayerProfiles = new PublicPlayerProfileService(
    dependencies.database,
    new PlayerPerformanceReadService(dependencies.database),
    new FootballPreferencesService(dependencies.database),
    new RewardService(dependencies.database),
    mediaService,
  );
  app.register(
    createPublicPlayerRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      publicPlayerProfiles,
    ),
  );
  app.register(
    createVenueRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new VenueService(dependencies.database),
    ),
  );
  app.register(
    createTerritorialRankingRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new TerritorialRankingService(dependencies.database),
    ),
  );
  app.register(
    createDiscoveryRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new GlobalRankingService(dependencies.database),
      new DiscoveryService(dependencies.database, publicPlayerProfiles),
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
  const recruitmentService = new MatchRecruitmentService(dependencies.database);
  app.register(
    createMatchRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new MatchService(dependencies.database, recruitmentService),
      new MatchCompletionService(dependencies.database),
      new MatchTeamService(dependencies.database),
      new MatchResultService(dependencies.database),
      recruitmentService,
    ),
  );
  app.register(
    createDirectedInvitationRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new InvitationService(dependencies.database),
      new MatchInvitationService(dependencies.database),
      new MatchService(dependencies.database),
    ),
  );
  app.register(
    createVotingRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new VotingService(dependencies.database),
    ),
  );
  const notificationService = new NotificationService(dependencies.database);
  app.register(
    createNotificationRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      notificationService,
    ),
  );
  app.register(
    createConnectionRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new ConnectionService(dependencies.database, notificationService),
    ),
  );
  const progression = new ProgressionService(dependencies.database);
  const rewards = new RewardService(dependencies.database);
  app.register(
    createRewardRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      rewards,
    ),
  );
  app.register(
    createProgressionRoutes(
      dependencies.auth,
      new PlayerService(dependencies.database),
      new ProgressionRevealService(dependencies.database, progression, rewards),
      new ProgressionHistoryService(dependencies.database),
    ),
  );
  return app;
}
