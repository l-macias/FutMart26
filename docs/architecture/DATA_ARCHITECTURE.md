# Data Architecture

## Database

PostgreSQL is the primary system of record.

ORM/query-builder decision remains open between Drizzle and Prisma until final architecture evaluation.

## Data principles

### Explicit identity

Use stable identifiers independent of user-facing names.

### Historical integrity

Do not delete or mutate historical truth merely because current configuration changed.

### Discipline awareness

Even though V1 contains only F5, sports performance data must reference discipline explicitly.

### Global player rating by discipline

A Player has one F5 competitive profile/rating across all groups.

Group-level statistics are projections/aggregates, not separate F5 ratings.

## Core conceptual records

Not final table names:

- Account
- Player
- PlayerDisciplineProfile
- PlayerDisciplinePreferences
- Group
- GroupMembership
- GroupPermission/ModeratorGrant
- Invitation
- Match
- MatchRegistration/Participation
- GuestParticipant
- GuestLinkProposal
- MatchRosterSnapshot/Confirmation
- Ballot
- PlayerEvaluation
- EvaluationTag/Evidence
- RatingConfiguration
- MatchmakingConfiguration
- ProgressionSnapshot
- ProgressionMilestone
- CardDefinition
- CardGrant/CurrentCard
- AwardDefinition
- AwardGrant
- AchievementDefinition
- AchievementGrant
- MatchStats
- NotificationPreference
- NotificationDelivery
- AuditRecord
- OutboxEvent

## Raw evidence vs projection

Preserve raw evidence:

- ballots;
- evaluation tags;
- stats;
- roster;
- config version/effective config reference.

Maintain cheap projections/summaries for:

- profile;
- ranking;
- group stats;
- current OVR/card;
- last activity;
- historical best.

Do not calculate profile screens by scanning every historical record.

## Configuration

Rating/matchmaking/card/award/achievement definitions are data.

Configuration changes are prospective.

Where reproducibility matters, progression snapshots store:

- before state;
- after state;
- delta;
- effective configuration identifier/version;
- match;
- timestamp.

## Precision

Internal rating/attribute values may use decimal precision.

Public card values may round to integers.

Never discard internal precision just because UI displays integers.

## Concurrency

Data model must support atomic enforcement of:

- unique group owner semantics;
- unique active membership where appropriate;
- unique active player participation per match;
- deterministic queue/waitlist order;
- unique voting submission/evaluation rules;
- unique achievement grants;
- one accepted Player link per guest participation.

## Indexing

Indexes follow actual access paths.

Expected high-value access paths:

- memberships by player/group;
- matches by group/date/status;
- registrations by match/status/order;
- voting by match/voter;
- F5 profile by player;
- progression by player/discipline/date;
- ranking read models;
- notification pending status;
- outbox pending status.

## Migrations

- version controlled;
- reviewed;
- forward-safe;
- avoid destructive migrations without explicit data plan;
- production schema changes must consider lock duration and online migration strategy as scale grows.

## Future scaling

Potential future techniques:

- read replicas;
- partition historical voting/events;
- cache read models;
- separate analytical workloads;
- archive cold data;
- sharding only if measured needs require it.

None are V1 implementation requirements.
