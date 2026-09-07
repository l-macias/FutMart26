import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";

import { resolveAuthIdentity, type FootballAuth } from "@football/auth";
import {
  adminHandleReportSchema,
  adminModerateGroupNameSchema,
  adminModerateNameSchema,
  adminMutationSchema,
  adminRevokeInvitationSchema,
  adminSearchQuerySchema,
} from "@football/contracts";
import type { Database } from "@football/database";

import type { ApiConfig } from "../../config.js";
import { ApplicationError } from "../errors.js";
import type { AdminService } from "./admin-service.js";
import type { AdminErrorBuffer } from "./admin-error-buffer.js";
import type { ReadinessService } from "../../runtime/readiness.js";

export function createAdminRoutes(
  auth: FootballAuth,
  database: Database,
  service: AdminService,
  config: ApiConfig,
  readiness: ReadinessService,
  errors: AdminErrorBuffer,
): FastifyPluginAsync {
  // Fastify requires an async plugin signature for encapsulated hooks/routes.
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (app) => {
    const actors = new WeakMap<FastifyRequest, string>();
    app.addHook("preHandler", async (request) => {
      const identity = await resolveAuthIdentity(auth, request.headers);
      if (!identity)
        throw new ApplicationError(
          "unauthenticated",
          "Authentication required",
          401,
        );
      await service.requireAdmin(identity.authUserId);
      actors.set(request, identity.authUserId);
    });
    const actor = (request: FastifyRequest) => actors.get(request)!;

    app.get("/admin/session", async (request) => ({
      role: (await service.requireAdmin(actor(request))).role,
    }));
    app.get("/admin/search", async (request) =>
      service.search(adminSearchQuerySchema.parse(request.query)),
    );
    app.get("/admin/overview", async () => service.overview());
    app.get("/admin/players", async (request) => {
      const page = listQuery(
        request.query as { q?: string; limit?: string; offset?: string },
      );
      const rows = await service.players({ ...page, limit: page.limit + 1 });
      return pageResult(rows, page.limit);
    });
    app.get("/admin/groups", async (request) => {
      const page = listQuery(
        request.query as { q?: string; limit?: string; offset?: string },
      );
      const rows = await service.groups({ ...page, limit: page.limit + 1 });
      return pageResult(rows, page.limit);
    });
    app.get("/admin/matches", async (request) => {
      const query = request.query as {
        q?: string;
        limit?: string;
        offset?: string;
        status?: string;
      };
      const statuses = ["DRAFT", "OPEN", "STARTED", "FINISHED", "CANCELLED"];
      if (query.status && !statuses.includes(query.status))
        throw new ApplicationError(
          "invalid_moderation_state",
          "Invalid match status",
          400,
        );
      const page = listQuery(query);
      const rows = await service.matches({
        ...page,
        limit: page.limit + 1,
        status: query.status,
      });
      return pageResult(rows, page.limit);
    });
    app.get<{ Params: { playerId: string } }>(
      "/admin/players/:playerId",
      async (request) => service.player(request.params.playerId),
    );
    app.get<{ Params: { groupId: string } }>(
      "/admin/groups/:groupId",
      async (request) => service.group(request.params.groupId),
    );
    app.get<{ Params: { matchId: string } }>(
      "/admin/matches/:matchId",
      async (request) => service.match(request.params.matchId),
    );
    app.get("/admin/reports", async (request) => {
      const query = request.query as {
        status?: string;
        targetType?: string;
        reason?: string;
      };
      const status = String(query.status ?? "OPEN");
      if (
        !(["OPEN", "RESOLVED", "DISMISSED"] as const).includes(status as never)
      )
        throw new ApplicationError(
          "invalid_moderation_state",
          "Invalid report status",
          400,
        );
      const targetTypes = ["PLAYER", "GROUP", "MATCH"] as const;
      const reasons = [
        "HARASSMENT",
        "INAPPROPRIATE_CONTENT",
        "IMPERSONATION",
        "SPAM",
        "SAFETY",
        "OTHER",
      ] as const;
      if (query.targetType && !targetTypes.includes(query.targetType as never))
        throw new ApplicationError(
          "invalid_moderation_state",
          "Invalid target type",
          400,
        );
      if (query.reason && !reasons.includes(query.reason as never))
        throw new ApplicationError(
          "invalid_moderation_state",
          "Invalid report reason",
          400,
        );
      return {
        items: await service.reports(
          status as "OPEN" | "RESOLVED" | "DISMISSED",
          query.targetType as (typeof targetTypes)[number] | undefined,
          query.reason as (typeof reasons)[number] | undefined,
        ),
      };
    });
    app.get<{ Params: { reportId: string } }>(
      "/admin/reports/:reportId",
      async (request) => service.report(request.params.reportId),
    );
    for (const status of ["RESOLVED", "DISMISSED"] as const) {
      app.post<{ Params: { reportId: string } }>(
        `/admin/reports/:reportId/${status.toLowerCase()}`,
        async (request, reply) => {
          const input = adminHandleReportSchema.parse(request.body);
          await service.handleReport(
            actor(request),
            request.id,
            request.params.reportId,
            status,
            input,
          );
          return reply.status(204).send();
        },
      );
    }
    app.post<{ Params: { playerId: string } }>(
      "/admin/players/:playerId/suspend",
      async (request, reply) => {
        const { reason } = adminMutationSchema.parse(request.body);
        await service.suspend(
          actor(request),
          request.id,
          request.params.playerId,
          reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { playerId: string } }>(
      "/admin/players/:playerId/reactivate",
      async (request, reply) => {
        const { reason } = adminMutationSchema.parse(request.body);
        await service.reactivate(
          actor(request),
          request.id,
          request.params.playerId,
          reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { playerId: string } }>(
      "/admin/players/:playerId/moderate-name",
      async (request, reply) => {
        const input = adminModerateNameSchema.parse(request.body);
        await service.moderatePlayerName(
          actor(request),
          request.id,
          request.params.playerId,
          input.displayName,
          input.reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { playerId: string } }>(
      "/admin/players/:playerId/remove-avatar",
      async (request, reply) => {
        const { reason } = adminMutationSchema.parse(request.body);
        await service.removeAvatar(
          actor(request),
          request.id,
          request.params.playerId,
          reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { groupId: string } }>(
      "/admin/groups/:groupId/force-private",
      async (request, reply) => {
        const { reason } = adminMutationSchema.parse(request.body);
        await service.moderateGroup(
          actor(request),
          request.id,
          request.params.groupId,
          "PRIVATE",
          reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { groupId: string } }>(
      "/admin/groups/:groupId/archive",
      async (request, reply) => {
        const { reason } = adminMutationSchema.parse(request.body);
        await service.moderateGroup(
          actor(request),
          request.id,
          request.params.groupId,
          "ARCHIVE",
          reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { groupId: string } }>(
      "/admin/groups/:groupId/moderate-name",
      async (request, reply) => {
        const input = adminModerateGroupNameSchema.parse(request.body);
        await service.moderateGroupName(
          actor(request),
          request.id,
          request.params.groupId,
          input.name,
          input.reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { matchId: string } }>(
      "/admin/matches/:matchId/cancel",
      async (request, reply) => {
        const { reason } = adminMutationSchema.parse(request.body);
        await service.cancelMatch(
          actor(request),
          request.id,
          request.params.matchId,
          reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { ballotId: string } }>(
      "/admin/voting/ballots/:ballotId/void",
      async (request, reply) => {
        const { reason } = adminMutationSchema.parse(request.body);
        await service.voidBallot(
          actor(request),
          request.id,
          request.params.ballotId,
          reason,
        );
        return reply.status(204).send();
      },
    );
    app.post<{ Params: { invitationId: string } }>(
      "/admin/invitations/:invitationId/revoke",
      async (request, reply) => {
        const input = adminRevokeInvitationSchema.parse(request.body);
        await service.revokeInvitation(
          actor(request),
          request.id,
          request.params.invitationId,
          input.kind,
          input.reason,
        );
        return reply.status(204).send();
      },
    );
    app.get("/admin/audit", async (request) => {
      const query = request.query as {
        actor?: string;
        action?: string;
        targetType?: string;
        targetId?: string;
        from?: string;
        to?: string;
        limit?: string;
      };
      const targetTypes = [
        "ACCOUNT",
        "PLAYER",
        "GROUP",
        "MATCH",
        "REPORT",
        "BALLOT",
        "INVITATION",
      ] as const;
      if (query.targetType && !targetTypes.includes(query.targetType as never))
        throw new ApplicationError(
          "invalid_moderation_state",
          "Invalid audit target type",
          400,
        );
      return {
        items: await service.auditEvents({
          actor: query.actor,
          action: query.action,
          targetType: query.targetType,
          targetId: query.targetId,
          from: parseDateFilter(query.from, "from"),
          to: parseDateFilter(query.to, "to"),
          limit: boundedLimit(query.limit, 100),
        }),
      };
    });
    app.get("/admin/errors", (request) => {
      const query = request.query as {
        status?: string;
        route?: string;
        errorCode?: string;
        from?: string;
        to?: string;
        limit?: string;
      };
      const status = query.status ? Number(query.status) : undefined;
      if (
        status !== undefined &&
        (!Number.isInteger(status) || status < 400 || status > 599)
      )
        throw new ApplicationError(
          "invalid_moderation_state",
          "Invalid error status",
          400,
        );
      return {
        items: errors.list({
          limit: boundedLimit(query.limit, 100),
          status,
          route: query.route,
          errorCode: query.errorCode,
          from: parseDateFilter(query.from, "from"),
          to: parseDateFilter(query.to, "to"),
        }),
        retention: { kind: "MEMORY", capacity: 200 },
      };
    });
    app.get("/admin/system", async () => {
      const runtime = await readiness.check();
      let latest: { id: number; created_at: string } | undefined;
      try {
        const migration = await database.execute<{
          id: number;
          created_at: string;
        }>(
          sql`select id, created_at from drizzle.__drizzle_migrations order by id desc limit 1`,
        );
        latest = Array.from(migration)[0];
      } catch {
        latest = undefined;
      }
      return {
        environment: config.NODE_ENV,
        api: runtime.status === "ready" ? "READY" : "NOT_READY",
        database: runtime.database === "ready" ? "READY" : "UNAVAILABLE",
        migration: {
          id: latest?.id ?? null,
          appliedAt: latest?.created_at ? String(latest.created_at) : null,
        },
        storageConfigured: runtime.storage !== "disabled",
        storageStatus: runtime.storage,
        mailConfigured: runtime.mail === "configured",
        migrationsStatus: runtime.migrations,
        emailVerificationRequired:
          process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === "true" ||
          config.NODE_ENV === "production",
        appVersion: runtime.version,
        gitSha: runtime.gitSha,
        buildTimestamp: runtime.buildTimestamp,
        uptimeSeconds: Math.floor(process.uptime()),
      };
    });
  };
}

function listQuery(query: { q?: string; limit?: string; offset?: string }) {
  const q = query.q?.trim();
  if (q && q.length > 100)
    throw new ApplicationError(
      "invalid_moderation_state",
      "Query is too long",
      400,
    );
  const offset = Number(query.offset ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10_000)
    throw new ApplicationError(
      "invalid_moderation_state",
      "Invalid pagination offset",
      400,
    );
  return {
    q: q || undefined,
    limit: boundedLimit(query.limit, 50),
    offset,
  };
}

function pageResult<T>(rows: T[], limit: number) {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

function boundedLimit(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100)
    throw new ApplicationError(
      "invalid_moderation_state",
      "Invalid limit",
      400,
    );
  return parsed;
}

function parseDateFilter(value: string | undefined, field: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new ApplicationError(
      "invalid_moderation_state",
      `Invalid ${field} date`,
      400,
    );
  return parsed;
}
