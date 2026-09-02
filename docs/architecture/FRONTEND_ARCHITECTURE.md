# Frontend Architecture

## Goals

- mobile-first;
- product-specific visual identity;
- feature ownership;
- easy replacement of mocks with real API;
- no business-rule duplication;
- no global-state dumping ground;
- maintainable by humans and coding agents.

## Feature-oriented structure

Conceptual layout:

```text
apps/web/src/
├── app/
│   ├── routing/
│   ├── providers/
│   └── shell/
├── features/
│   ├── auth/
│   ├── home/
│   ├── groups/
│   ├── matches/
│   ├── participation/
│   ├── matchmaking/
│   ├── voting/
│   ├── progression/
│   ├── rankings/
│   ├── profile/
│   └── notifications/
└── shared/
```

Features may contain:

- components;
- screens;
- model/view-model code;
- API adapters/hooks;
- local utilities.

Do not create nested ceremony when a feature is small.

## Shared UI layers

### `packages/ui`

Neutral primitives:

- Button;
- Input;
- Select;
- Dialog;
- Sheet;
- Tabs;
- Text;
- Stack/layout utilities;
- accessible form controls.

### `packages/football-ui`

Product components:

- PlayerCard;
- MiniPlayerCard;
- MatchState;
- FootballPitch;
- PlayerToken;
- RatingDisplay;
- RatingDelta;
- ProgressionReveal;
- AwardMark;
- AchievementMark;
- RankingRow;
- RosterStatus.

Product components may use primitives but primitives must not import football-specific concepts.

## Server state

Use TanStack Query or equivalent.

Do not duplicate API state into a global client store without a concrete need.

### Query reliability policy

The QueryClient does not retry domain/auth/validation failures. Network reads
may retry twice; server failures retry once. Mutations never retry globally.
Default freshness is 30 seconds with explicit categories available to features:

- volatile (Match/Voting/Notifications): 10 seconds;
- semi-stable (Rankings/Discovery/Activity): 60 seconds;
- stable (identity/policies/catalogs): 5 minutes.

Logout and account deletion clear private cache. Product mutations invalidate
only affected projections. Search requests receive TanStack's `AbortSignal` so
obsolete responses cannot replace newer results.

## Local state

Prefer component/local feature state.

Introduce global client state only for genuinely cross-cutting ephemeral UI needs.

## Domain rules

Frontend can guide and prevent obvious invalid actions, but backend remains authoritative.

Examples:

- UI may hide `join` when already joined;
- backend still validates uniqueness/capacity.

## Mock-first architecture

The frontend prototype must consume a stable application/API client boundary.

Conceptually:

```text
Feature UI
   ↓
Application client contract
   ↓
Mock adapter (prototype)
```

Later:

```text
Feature UI
   ↓
same application client contract
   ↓
HTTP adapter
```

Mocks must model real states and transitions instead of static fixture-only screens.

## Styling

- use design tokens;
- no arbitrary repeated colors/radii/spacing in feature code;
- no one-off visual patterns without design-system consideration;
- no generic dashboard aesthetic by default;
- no duplicated card implementations.

## Accessibility

- keyboard/tap operable;
- semantic controls;
- focus states;
- sufficient contrast;
- reduced-motion fallback;
- readable at narrow mobile widths.

## Performance

- route/feature splitting where useful;
- bounded lists;
- image optimization;
- avoid unnecessary rerender-heavy global stores;
- do not prematurely optimize before measurement.

## Testing

Focus on:

- critical flows;
- complicated state transitions;
- permissions display where regression-prone;
- voting/progression interactions.

Avoid exhaustive tests for trivial visual primitives unless they protect important accessibility/behavior.
