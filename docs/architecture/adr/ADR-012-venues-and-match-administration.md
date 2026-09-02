# ADR-012: Venues and pre-match administration

## Status

Accepted for Product Integration Slice 2.

## Context

Matches already preserve a manual `locationText`, but recurring Groups need reusable locations. A Venue is the first globally shared sporting entity: the Player who creates it must not become an unrestricted global editor. Pre-match administration also needs to cancel another participant and deliberately override one waitlist position without violating capacity.

## Decision

- `Venue` is global, reusable and identified for V1 by an active normalized `(name, city)` pair. Homonyms in different cities are valid. No fuzzy merge occurs.
- Registered Venues require a human display name and free-text city. The city string is a pilot seam, not a geographic identity or ranking key.
- Venue may additionally store canonical `countryCode` (ISO 3166-1 alpha-2)
  and `provinceCode` (ISO 3166-2 compatible). Province is country-scoped and
  its prefix must equal Country. Codes are identity; presenter labels are not.
- Canonical geography is never inferred from City or address. Legacy Venues may
  retain null codes: this excludes only the missing Country/Province ranking
  scopes and does not affect Matches, Venue Ranking or City Ranking.
- Courts belong to one Venue and active normalized Court names are unique within that Venue. A Match may reference only a Court belonging to its Venue.
- A Match supports either structured `venueId` plus optional `courtId`, or manual `locationText`. Structured selections still snapshot a human `locationText` so historical reads do not depend on a mutable presentation join.
- V1 exposes create/search/list operations but no global Venue or Court edit operation. Moderation, claim, verification and official geographic catalogues are deferred.
- Group Match defaults are changed only by an explicit opt-in during Draft creation. An exceptional Match never mutates recurring defaults implicitly.
- All participant admission remains serialized on the Match row. Administrative cancellation records the acting Player and invokes the ordinary first-waitlisted promotion in the same transaction.
- A waitlist override is an explicit atomic swap: one WAITLISTED participant becomes CONFIRMED and one selected CONFIRMED participant becomes WAITLISTED. The demoted participant receives a new admission order at the tail, so later ordinary promotion remains deterministic. The operation never exceeds capacity.
- Schedule changes preserve all admissions and append an audit record containing old/new time and actor. No reconfirmation or notification provider is introduced in V1.

## Consequences

Venue duplication is conservatively surfaced as a conflict candidate instead of silently merged. City normalization is intentionally replaceable by a future official catalogue. Country/Province codes provide a catalogue-ready seam without introducing geography tables or automatic enrichment. Historical Match location remains readable. Administrative operations are distinguishable from self-service actions and preserve the shared Player/Guest waitlist invariant.
