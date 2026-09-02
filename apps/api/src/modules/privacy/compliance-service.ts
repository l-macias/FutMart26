import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import {
  PRIVACY_VERSION,
  TERMS_VERSION,
  type PrivatePlayer,
} from "@football/contracts";
import type { Database } from "@football/database";
import {
  playerFootballPreferences,
  players,
  policyAcceptances,
} from "@football/database/schema";

import { ApplicationError } from "../errors.js";

export function ageOn(dateOfBirth: string, now = new Date()) {
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) return -1;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return -1;
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  return (
    currentYear -
    year -
    (currentMonth < month || (currentMonth === month && currentDay < day)
      ? 1
      : 0)
  );
}

export class ComplianceService {
  constructor(
    private readonly database: Database,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async status(authUserId: string, playerId: string) {
    const [player, acceptances, [preferences]] = await Promise.all([
      this.database.query.players.findFirst({
        where: eq(players.id, playerId),
      }),
      this.database
        .select({
          type: policyAcceptances.type,
          version: policyAcceptances.version,
        })
        .from(policyAcceptances)
        .where(eq(policyAcceptances.authUserId, authUserId)),
      this.database
        .select({ id: playerFootballPreferences.id })
        .from(playerFootballPreferences)
        .where(
          and(
            eq(playerFootballPreferences.playerId, playerId),
            eq(playerFootballPreferences.discipline, "F5"),
          ),
        )
        .limit(1),
    ]);
    if (!player)
      throw new ApplicationError("player_not_found", "Player not found", 404);
    const age = player.dateOfBirth
      ? ageOn(player.dateOfBirth, this.now())
      : null;
    const acceptedTerms = acceptances.some(
      (item) => item.type === "TERMS" && item.version === TERMS_VERSION,
    );
    const acceptedPrivacy = acceptances.some(
      (item) => item.type === "PRIVACY" && item.version === PRIVACY_VERSION,
    );
    const state =
      player.accountStatus === "ANONYMIZED"
        ? "ACCOUNT_ANONYMIZED"
        : !player.dateOfBirth
          ? "MISSING_DATE_OF_BIRTH"
          : age === null || age < 18
            ? "UNDERAGE"
            : !acceptedTerms || !acceptedPrivacy
              ? "POLICIES_REQUIRED"
              : !preferences
                ? "FOOTBALL_PROFILE_REQUIRED"
                : "READY";
    return {
      state,
      hasDateOfBirth: player.dateOfBirth !== null,
      isAdult: age === null ? null : age >= 18,
      age,
      acceptedTerms,
      acceptedPrivacy,
      requiredTermsVersion: TERMS_VERSION,
      requiredPrivacyVersion: PRIVACY_VERSION,
    } as const;
  }

  async complete(
    authUserId: string,
    playerId: string,
    input: { dateOfBirth?: string; acceptTerms: true; acceptPrivacy: true },
  ) {
    await this.database.transaction(async (tx) => {
      const locked = await tx.execute<{
        date_of_birth: string | null;
        account_status: string;
      }>(sql`
        select ${players.dateOfBirth} as date_of_birth,
          ${players.accountStatus} as account_status
        from ${players}
        where ${players.id} = ${playerId}
        for update
      `);
      const player = Array.from(locked)[0];
      if (!player)
        throw new ApplicationError("player_not_found", "Player not found", 404);
      if (player.account_status !== "ACTIVE")
        throw new ApplicationError(
          "account_anonymized",
          "Account is inactive",
          403,
        );
      const dateOfBirth = player.date_of_birth ?? input.dateOfBirth;
      if (!dateOfBirth)
        throw new ApplicationError(
          "date_of_birth_required",
          "Date of birth is required",
          400,
        );
      if (
        player.date_of_birth &&
        input.dateOfBirth &&
        input.dateOfBirth !== player.date_of_birth
      )
        throw new ApplicationError(
          "date_of_birth_locked",
          "Date of birth is already confirmed",
          409,
        );
      const age = ageOn(dateOfBirth, this.now());
      if (age < 0 || age > 120)
        throw new ApplicationError(
          "invalid_date_of_birth",
          "Invalid date of birth",
          400,
        );
      if (age < 18)
        throw new ApplicationError(
          "underage",
          "Beta access requires age 18 or older",
          403,
        );
      if (!player.date_of_birth)
        await tx
          .update(players)
          .set({ dateOfBirth, updatedAt: this.now() })
          .where(eq(players.id, playerId));
      await tx
        .insert(policyAcceptances)
        .values([
          {
            id: randomUUID(),
            authUserId,
            type: "TERMS",
            version: TERMS_VERSION,
          },
          {
            id: randomUUID(),
            authUserId,
            type: "PRIVACY",
            version: PRIVACY_VERSION,
          },
        ])
        .onConflictDoNothing();
    });
    return this.status(authUserId, playerId);
  }

  async privateIdentity(
    playerId: string,
  ): Promise<
    Pick<
      PrivatePlayer,
      "dateOfBirth" | "age" | "profileVisibility" | "accountStatus"
    >
  > {
    const [player] = await this.database
      .select({
        dateOfBirth: players.dateOfBirth,
        profileVisibility: players.profileVisibility,
        accountStatus: players.accountStatus,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    if (!player)
      throw new ApplicationError("player_not_found", "Player not found", 404);
    return {
      ...player,
      age: player.dateOfBirth ? ageOn(player.dateOfBirth, this.now()) : null,
    };
  }

  async setPlayerVisibility(
    playerId: string,
    visibility: "PUBLIC" | "PRIVATE",
  ) {
    await this.database
      .update(players)
      .set({ profileVisibility: visibility, updatedAt: this.now() })
      .where(
        and(eq(players.id, playerId), eq(players.accountStatus, "ACTIVE")),
      );
    return { profileVisibility: visibility };
  }
}
