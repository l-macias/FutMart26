# Component Principles

## Separation

### Primitive

Generic, reusable, product-agnostic.

### Product component

Understands football concepts but not application business workflows.

### Feature component

Owns a specific screen/workflow.

Do not collapse all three into one layer.

## Examples

Primitive:

- Button
- Dialog
- Input

Product:

- PlayerCard
- FootballPitch
- RatingDelta

Feature:

- MatchRosterConfirmation
- FullVotingFlow
- ProgressionResultScreen

## Business logic

Components do not become authorities for domain invariants.

Feature components coordinate UI state and invoke application contracts.

Backend remains authoritative.

## Composition

Prefer composition over giant configurable components with dozens of boolean props.

Avoid:

```text
<PlayerCard compact small dark interactive admin sortable editable ...>
```

Create clear variants only where the product meaning warrants them.

## Ownership

A component lives with the feature that owns it until reuse is real.

Do not move everything into shared packages prematurely.

## Styling

Use design tokens.

Product components may own football-specific layout, but should not invent global visual language.

## API surface

Keep component contracts explicit and typed.

Do not pass enormous generic objects when a narrow view model is sufficient.

## Accessibility

Interactive visual components must have:

- semantic interaction;
- keyboard fallback;
- accessible names;
- non-color-only status communication.

## Agent rule

Before creating a new shared component, Codex should search for:

- an existing primitive;
- an existing football component;
- a feature-local implementation that should remain local.

Shared abstraction requires evidence of reuse or a stable system boundary.
