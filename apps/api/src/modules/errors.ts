export type ApplicationErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "player_not_found"
  | "group_not_found"
  | "membership_not_found"
  | "already_member"
  | "invalid_role_transition"
  | "ownership_invariant_violation"
  | "concurrency_conflict"
  | "match_not_found"
  | "match_not_open"
  | "not_participating"
  | "roster_locked"
  | "invalid_match_transition"
  | "capacity_below_confirmed"
  | "invalid_capacity"
  | "group_archived"
  | "invalid_final_roster"
  | "roster_not_confirmed"
  | "stats_not_allowed";

export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
