# ADR-010 — Match teams, deterministic matchmaking and sporting result

## Status

Accepted.

## Decision

`TEAM_A` and `TEAM_B` are Match-scoped sides. They are not Group entities and do not represent clubs or persistent lineups. A future saved-lineup feature may provide input to a Match, but cannot own its final historical assignments.

`match_team_assignments` maps one `match_participant` to one side. A composite foreign key over `(participant_id, match_id)` prevents cross-Match assignment. Both Players and Guests may be assigned. Assignments are replaceable only while the Match is `OPEN`; `START` requires every currently `CONFIRMED` participant to have exactly one assignment and then makes assignments ordinarily immutable. A later `NO_SHOW` retains the locked assignment as historical evidence but is excluded from sporting-result validation.

## Deterministic proposal

The V1 proposal performs bounded exhaustive combination search for at most 12 F5 participants. Inputs are sorted by stable participant ID and no random source is used. Candidates are compared lexicographically:

1. goalkeeper coverage;
2. avoiding an underpowered smaller side for odd rosters;
3. average internal OVR difference;
4. rating-profile count difference;
5. stable participant-ID tie-break.

Team sizes are fixed to equal sides for even rosters and a one-player difference for odd rosters. Average OVR, rather than raw total OVR, is the strength metric for 5v4. PlayerPerformance internal OVR is used when present; new Players and Guests use 60. Goalkeeper willingness is an independent input and never changes OVR. The current persistent model has no goalkeeper-preference field, so production generation reports missing coverage instead of fabricating willingness; the pure algorithm already supports the future bootstrap seam.

## Sporting result

`match_sporting_results` has `DRAFT`, `CONFIRMED`, and `NOT_PLAYED` states. `team_a_goals` and `team_b_goals` are authoritative for a played Match; winner or `DRAW` is derived. `0–0` is therefore a real draw. `NOT_PLAYED` has null scores and closes a Match whose confirmed final roster contains zero `PLAYED` participants without inventing a draw.

Existing aggregate `match_participant_stats` rows remain the V1 representation for goals and assists; no GoalEvent timeline is introduced. At confirmation:

- the Match is `FINISHED` and final roster is confirmed;
- every `PLAYED` participant has one locked assignment;
- goals per side equal that side's score exactly;
- assists per side do not exceed that side's goals;
- no-show, waitlisted, or cancelled participants contribute no stats.

Guests may score and assist, but never gain PlayerPerformance.

## Lifecycle integration

Ordinary result/stat edits are allowed before a VotingSession exists. Editing a previously confirmed result reopens it as `DRAFT`; it must be confirmed again. Voting opening now requires `sporting_result = CONFIRMED`. `NOT_PLAYED` does not open Voting because there are no sporting participants.

Creating future Match drafts remains allowed. Publishing a Match is blocked while an earlier Match in the same Group, ordered by `(scheduled_at, match_id)`, is finished with at least one played participant but lacks `CONFIRMED` sporting closure. Cancelled Matches and confirmed `NOT_PLAYED` closure do not block.

## Concurrency

Team replacement/generation, `START`, sporting-result writes/confirmation, and Voting opening lock the parent Match row with `SELECT ... FOR UPDATE`. Therefore edit-versus-start and confirm-versus-Voting races have one serial order. Result confirmation validates score, stats, attendance, assignments, and Voting absence in one transaction. Database uniqueness and the composite foreign key protect assignment identity in addition to application validation.

## Consequences

- no persistent Group Team is introduced;
- saved lineups, advanced formations, GoalEvent history, exceptional post-Voting correction, and team ratings remain deferred;
- goalkeeper diagnostics are honest until a separately governed preference/bootstrap model exists;
- the result can now be attributed to the exact locked participants and sides that produced it.
