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
  | "stats_not_allowed"
  | "voting_not_found"
  | "voting_not_eligible_yet"
  | "voting_not_open"
  | "voter_not_eligible"
  | "invalid_ballot"
  | "ballot_already_submitted"
  | "progression_not_ready"
  | "invalid_progression_evidence"
  | "progression_out_of_order"
  | "progression_config_not_found"
  | "invalid_team_assignment"
  | "teams_locked"
  | "incomplete_team_assignments"
  | "invalid_sporting_result"
  | "sporting_result_not_ready"
  | "sporting_result_locked"
  | "sporting_result_not_confirmed"
  | "prior_match_sporting_closure_required"
  | "invitation_not_available"
  | "invalid_invitation"
  | "member_blocked"
  | "guest_not_found"
  | "guest_name_conflict"
  | "guest_policy_disabled"
  | "guest_allowance_exceeded"
  | "guest_not_reusable"
  | "invalid_football_preferences";

export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    readonly statusCode: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}
