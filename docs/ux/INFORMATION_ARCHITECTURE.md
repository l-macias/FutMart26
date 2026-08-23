# Information Architecture

## Principle

The application has two simultaneous layers:

1. **My football** — what I need to play and manage my activity.
2. **The football world around me** — rankings, progress, ecosystem and discovery of what the product offers.

## Primary V1 navigation

```text
HOME
JUGAR
GRUPOS
RANKINGS
PERFIL
```

Exact labels may be refined during prototype testing.

## Home

Purpose:

- explain the product briefly;
- expose the ecosystem;
- surface rankings and progression;
- route users into major areas.

For new users:

- stronger product explanation;
- create/join group calls to action;
- simple "how it works".

For active users:

- explanation becomes compact;
- live/relevant ecosystem content becomes dominant.

Potential Home modules:

- global F5 ranking;
- rising players;
- recent card upgrades;
- ecosystem activity;
- paths to Groups, Play, Rankings, Profile.

Avoid generic SaaS dashboard cards.

## Jugar

Personal operational center.

Contains:

- next match;
- upcoming matches;
- current registration state;
- waitlist status;
- pending voting;
- results ready;
- relevant actions.

## Grupos

Contains:

- user's groups;
- upcoming activity per group;
- group detail;
- members;
- matches;
- group rankings/stat summaries;
- administration actions when authorized.

Owner/moderator actions appear contextually; they do not require a completely different user application.

## Rankings

Contains:

- F5 global ranking;
- group-specific rankings;
- distinct ranking dimensions where relevant.

Do not collapse:

- OVR;
- recent form;
- goals;
- assists;
- awards
  into a single ambiguous score.

## Perfil

The player's career space.

Sections may include:

- summary/card;
- stats;
- progression;
- awards;
- achievements;
- groups.

The F5 card is the primary visual anchor in V1.

Future F7/F11 sections appear only when the player has real activity in those disciplines.

## Superadmin

Separate application/surface.

Not part of the five player-facing primary destinations.

Owns product configuration and audit.

## Future navigation

Possible future additions:

- Competitions/Leagues;
- Discovery;
- Social;
- Messages.

They must not force a redesign of the V1 navigation model.
