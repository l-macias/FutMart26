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

- answer what the Player needs to know or do now;
- prioritize a current or next Match;
- show at most five unread Notifications as attention items;
- preview at most three recruitment opportunities;
- summarize personal OVR and global position without duplicating Profile or
  Rankings.

Home is authenticated and personal. It does not host a leaderboard, global
discovery catalogue, Group feed or Match history.

Avoid generic SaaS dashboard cards.

## Jugar

Personal Match center. It answers when the Player plays and where they can
play.

Contains:

- next match;
- current Match when one is `STARTED`;
- open recruitment opportunities;
- upcoming Matches where the actor is confirmed or waitlisted;
- bounded FINISHED/CANCELLED history;
- current registration state;
- waitlist status;

Home previews one Match and three opportunities. Jugar owns the complete
bounded lists. Drafts remain an organizer concern and recent Group activity
does not live here.

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

- one F5 ranking context at a time;
- `GLOBAL` as the default platform-wide context;
- `GRUPO`, limited to the actor's active Groups with ranking evidence;
- `CIUDAD` and `SEDE`, selected only from stored sporting evidence.

`/rankings` is the primary competitive explorer. Its URL preserves scope and
context so Group summaries can link into the same surface. Province and Country
read models remain available for future density, but are not primary V1 scopes.
Match Detail never embeds territorial rankings.

Do not collapse:

- OVR;
- recent form;
- goals;
- assists;
- awards
  into a single ambiguous score.

## Perfil

The player's identity and career space. `/profile` prioritizes the F5 Card,
football profile and a bounded career summary. Full match-by-match Progression
is loaded only from `/profile/progression`; Groups and the Player's network are
compact navigation contexts rather than directories embedded in Profile.

Public Player Profile is a separate composition: public identity, current
performance, public Groups, achievements and authoritative award totals. It
never exposes private Groups, Account data or Progression History.

Profile and Account controls live under `/profile/settings`, which links to the
existing identity/avatar/privacy, F5 preferences, Account/security and legal
surfaces. Settings do not compete with sporting history.

The F5 card remains the primary visual anchor in V1. Achievements are career
milestones; match Awards are grouped by type and retain their detailed source
records in the domain.

Future F7/F11 sections appear only when the player has real activity in those disciplines.

## Notificaciones

The header bell is a recent-events preview, not a shortcut that replaces the
current screen. It shows the latest five Notifications, keeps read and unread
items together, exposes the single authoritative unread count and links to the
complete inbox.

`/notifications` owns the cursor-paginated history. It can filter between all
and unread items and shares mark-one/mark-all mutations and cache invalidation
with the header preview and Home attention. Home continues to include only
bounded actionable unread items; informative achievements and Awards remain in
the complete inbox.

Every Notification target is produced by the API from preserved sporting or
social context. Match, Group, Profile, Connection and Invitation screens remain
responsible for their safe unavailable or unauthorized state.

## Búsqueda

`/search?q=...` is the global search surface. It searches only after two
characters, keeps the query in the URL and presents bounded `JUGADORES` and
`GRUPOS` sections instead of mixing entity types or acting as a discovery feed.

Player results link to Public Player Profile. Public Groups remain discoverable
by name, but only an active member receives a Group Detail target because V1
does not have a Public Group Profile. PRIVATE Players and Groups are never
returned by global Search.

## Configuración y gestión

`/groups/:groupId/settings` owns Group administration and uses progressive
sections in this order: General, Members, Invitations, persistent Guests,
Ownership and Risk Zone. The Group Overview never hosts these forms. Each
section remains capability-aware, uses human role/capability labels and keeps
archive, leave and ownership transfer behind explicit confirmation.

Match Detail keeps one secondary `ADMINISTRAR PARTIDO` entry. Its contents are
state-specific: Draft configures and publishes; Open manages data,
recruitment, participants, Guests and teams; Started leads to attendance,
result and closure; Finished exposes only a closure review while the domain
still marks it editable. Cancellation is isolated as a destructive action.

`/profile/settings` separates sporting identity, F5 preferences, account
security, legal links and account deletion. Password and sessions remain under
`/profile/account`; deletion is the final Risk Zone and requires both typed
confirmation/password and a final dialog. Settings never expose or request
technical resource IDs.

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
