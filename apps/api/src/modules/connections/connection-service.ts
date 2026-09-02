import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import type {
  ConnectionListResponse,
  ConnectionRequestListResponse,
  ConnectionStatus,
} from "@football/contracts";
import { idSchema } from "@football/contracts";
import type { Database } from "@football/database";
import {
  playerConnections,
  playerPerformances,
  players,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";
import type { NotificationService } from "../notifications/notification-service.js";

const cursorSchema = z
  .object({
    version: z.literal(1),
    occurredAt: z.iso.datetime(),
    playerId: idSchema,
  })
  .strict();

type ListInput = { limit: number; cursor?: string };

export class ConnectionService {
  constructor(
    private readonly database: Database,
    private readonly notifications?: NotificationService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async request(actorPlayerId: string, targetPlayerId: string) {
    if (actorPlayerId === targetPlayerId)
      throw new ApplicationError(
        "invalid_connection",
        "A Player cannot connect with themselves",
        422,
      );
    await this.requirePlayer(targetPlayerId);
    const [playerLowId, playerHighId] = pair(actorPlayerId, targetPlayerId);
    const now = this.clock();
    const inserted = await this.database
      .insert(playerConnections)
      .values({
        id: randomUUID(),
        playerLowId,
        playerHighId,
        requesterPlayerId: actorPlayerId,
        status: "PENDING",
        requestedAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({
        target: [playerConnections.playerLowId, playerConnections.playerHighId],
      })
      .returning({ id: playerConnections.id });
    if (inserted.length > 0)
      await this.notifications
        ?.connectionRequested(
          inserted[0]!.id,
          actorPlayerId,
          targetPlayerId,
          now,
        )
        .catch(() => undefined);
    return this.status(actorPlayerId, targetPlayerId);
  }

  async accept(actorPlayerId: string, targetPlayerId: string) {
    const [playerLowId, playerHighId] = pair(actorPlayerId, targetPlayerId);
    const now = this.clock();
    const [updated] = await this.database
      .update(playerConnections)
      .set({ status: "ACCEPTED", acceptedAt: now, updatedAt: now })
      .where(
        and(
          eq(playerConnections.playerLowId, playerLowId),
          eq(playerConnections.playerHighId, playerHighId),
          eq(playerConnections.status, "PENDING"),
          sql`${playerConnections.requesterPlayerId} <> ${actorPlayerId}`,
        ),
      )
      .returning({
        id: playerConnections.id,
        requesterPlayerId: playerConnections.requesterPlayerId,
      });
    if (updated) {
      await this.notifications
        ?.connectionAccepted(
          updated.id,
          actorPlayerId,
          updated.requesterPlayerId,
          now,
        )
        .catch(() => undefined);
      return this.status(actorPlayerId, targetPlayerId);
    }
    const state = await this.status(actorPlayerId, targetPlayerId);
    if (state.state === "CONNECTED") return state;
    throw new ApplicationError(
      "connection_not_found",
      "Incoming connection request not found",
      404,
    );
  }

  reject(actorPlayerId: string, targetPlayerId: string) {
    return this.deletePending(actorPlayerId, targetPlayerId, "incoming");
  }

  cancel(actorPlayerId: string, targetPlayerId: string) {
    return this.deletePending(actorPlayerId, targetPlayerId, "outgoing");
  }

  async remove(actorPlayerId: string, targetPlayerId: string) {
    const [playerLowId, playerHighId] = pair(actorPlayerId, targetPlayerId);
    await this.database
      .delete(playerConnections)
      .where(
        and(
          eq(playerConnections.playerLowId, playerLowId),
          eq(playerConnections.playerHighId, playerHighId),
          eq(playerConnections.status, "ACCEPTED"),
        ),
      );
    return this.status(actorPlayerId, targetPlayerId);
  }

  async status(
    actorPlayerId: string,
    targetPlayerId: string,
  ): Promise<ConnectionStatus> {
    if (actorPlayerId === targetPlayerId) return { state: "NONE" };
    const [playerLowId, playerHighId] = pair(actorPlayerId, targetPlayerId);
    const [row] = await this.database
      .select()
      .from(playerConnections)
      .where(
        and(
          eq(playerConnections.playerLowId, playerLowId),
          eq(playerConnections.playerHighId, playerHighId),
        ),
      )
      .limit(1);
    if (!row) return { state: "NONE" };
    if (row.status === "ACCEPTED")
      return {
        state: "CONNECTED",
        connectedAt: row.acceptedAt!.toISOString(),
      };
    return {
      state:
        row.requesterPlayerId === actorPlayerId
          ? "PENDING_SENT"
          : "PENDING_RECEIVED",
      requestedAt: row.requestedAt.toISOString(),
    };
  }

  list(actorPlayerId: string, input: ListInput) {
    return this.listRows(actorPlayerId, "connections", input);
  }

  listRequests(
    actorPlayerId: string,
    direction: "incoming" | "outgoing",
    input: ListInput,
  ) {
    return this.listRows(actorPlayerId, direction, input);
  }

  private async deletePending(
    actorPlayerId: string,
    targetPlayerId: string,
    direction: "incoming" | "outgoing",
  ) {
    const [playerLowId, playerHighId] = pair(actorPlayerId, targetPlayerId);
    const requesterCondition =
      direction === "outgoing"
        ? eq(playerConnections.requesterPlayerId, actorPlayerId)
        : sql`${playerConnections.requesterPlayerId} <> ${actorPlayerId}`;
    await this.database
      .delete(playerConnections)
      .where(
        and(
          eq(playerConnections.playerLowId, playerLowId),
          eq(playerConnections.playerHighId, playerHighId),
          eq(playerConnections.status, "PENDING"),
          requesterCondition,
        ),
      );
    const state = await this.status(actorPlayerId, targetPlayerId);
    if (state.state !== "NONE")
      throw new ApplicationError(
        "connection_not_found",
        "Connection request not found",
        404,
      );
    return state;
  }

  private async listRows(
    actorPlayerId: string,
    mode: "connections" | "incoming" | "outgoing",
    input: ListInput,
  ): Promise<ConnectionListResponse | ConnectionRequestListResponse> {
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    const otherPlayerId = sql<string>`case when ${playerConnections.playerLowId} = ${actorPlayerId} then ${playerConnections.playerHighId} else ${playerConnections.playerLowId} end`;
    const occurredAt =
      mode === "connections"
        ? playerConnections.acceptedAt
        : playerConnections.requestedAt;
    const cursorCondition = cursor
      ? or(
          lt(occurredAt, new Date(cursor.occurredAt)),
          and(
            eq(occurredAt, new Date(cursor.occurredAt)),
            sql`${otherPlayerId} > ${cursor.playerId}`,
          ),
        )
      : undefined;
    const statusCondition = eq(
      playerConnections.status,
      mode === "connections" ? "ACCEPTED" : "PENDING",
    );
    const directionCondition =
      mode === "outgoing"
        ? eq(playerConnections.requesterPlayerId, actorPlayerId)
        : mode === "incoming"
          ? sql`${playerConnections.requesterPlayerId} <> ${actorPlayerId}`
          : undefined;
    const otherPlayers = alias(players, "connection_other_players");
    const performance = alias(
      playerPerformances,
      "connection_other_performance",
    );
    const rows = await this.database
      .select({
        playerId: otherPlayers.id,
        displayName: otherPlayers.displayName,
        overall: performance.internalOvr,
        processedMatchCount: performance.processedMatchCount,
        occurredAt,
      })
      .from(playerConnections)
      .innerJoin(otherPlayers, eq(otherPlayers.id, otherPlayerId))
      .leftJoin(
        performance,
        and(
          eq(performance.playerId, otherPlayers.id),
          eq(performance.discipline, "F5"),
        ),
      )
      .where(
        and(
          or(
            eq(playerConnections.playerLowId, actorPlayerId),
            eq(playerConnections.playerHighId, actorPlayerId),
          ),
          statusCondition,
          directionCondition,
          cursorCondition,
        ),
      )
      .orderBy(desc(occurredAt), otherPlayers.id)
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    return {
      items: page.map((row) => ({
        player: { id: row.playerId, displayName: row.displayName },
        overall: row.overall === null ? null : Number(row.overall),
        processedMatchCount: row.processedMatchCount ?? 0,
        [mode === "connections" ? "connectedAt" : "requestedAt"]:
          row.occurredAt!.toISOString(),
      })) as ConnectionListResponse["items"] &
        ConnectionRequestListResponse["items"],
      nextCursor:
        rows.length > input.limit && page.length > 0
          ? encodeCursor({
              version: 1,
              occurredAt: page.at(-1)!.occurredAt!.toISOString(),
              playerId: page.at(-1)!.playerId,
            })
          : null,
    };
  }

  private async requirePlayer(playerId: string) {
    const [player] = await this.database
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    if (!player)
      throw new ApplicationError("player_not_found", "Player not found", 404);
  }
}

function pair(first: string, second: string): [string, string] {
  return first < second ? [first, second] : [second, first];
}

function encodeCursor(cursor: z.infer<typeof cursorSchema>) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string) {
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new ApplicationError("invalid_cursor", "Invalid cursor", 400);
  }
}
