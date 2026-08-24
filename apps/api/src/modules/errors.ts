export type ApplicationErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "player_not_found"
  | "group_not_found"
  | "membership_not_found"
  | "already_member"
  | "invalid_role_transition"
  | "ownership_invariant_violation"
  | "concurrency_conflict";

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
