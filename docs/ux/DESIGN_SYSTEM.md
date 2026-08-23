# Design System

## Purpose

Prevent visual spaghetti and give the product a recognizable identity.

## Token-first rule

Reusable visual values belong to tokens rather than feature-level arbitrary constants.

Token categories:

- color;
- typography;
- spacing;
- radius;
- border;
- elevation;
- motion;
- z-index;
- breakpoints;
- card geometry;
- tier styles.

## Color tokens

Conceptual groups:

```text
surface.*
text.*
border.*
brand.*
pitch.*
state.confirmed
state.waitlisted
state.voting
state.cancelled
progress.positive
progress.negative
tier.*
```

Exact values remain a visual-design task.

## Typography tokens

Roles:

- display-xl / display-lg;
- score/ovr;
- heading;
- body;
- label;
- metadata.

Do not introduce arbitrary font sizes per screen.

## Spacing

Use a coherent scale.

Avoid one-off values unless required by card art geometry or another documented fixed layout.

## Radius

Product should not become a collection of rounded rectangles.

Use radius deliberately:

- interactive controls;
- sheets/dialogs;
- selected surfaces;
- card system geometry.

## Icons

Generic icons are acceptable for universal utility actions:

- close;
- back;
- settings;
- share.

Football/game concepts should use a dedicated product icon language when practical:

- goal;
- assist;
- goalkeeper;
- role;
- rating;
- card;
- award;
- achievement.

Do not use emojis as final product iconography unless intentionally specified.

## Components

### Neutral primitives

Live in `packages/ui`.

### Football components

Live in `packages/football-ui`.

A feature should not create its own duplicate Button/Card/Badge because the design system is inconvenient.

## Responsive

Mobile-first.

The system must work at narrow widths before desktop adaptations are added.

Desktop should reinterpret layout, not simply stretch mobile cards.

## Accessibility

Tokens must preserve:

- contrast;
- readable type;
- focus indication;
- minimum touch target;
- reduced motion.

## Agent rule

Codex must not introduce:

- new brand colors;
- new font families;
- arbitrary tier colors;
- new radii;
- custom shadows;
- motion timing
  without extending or intentionally using the design system.
