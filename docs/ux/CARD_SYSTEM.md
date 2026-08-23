# Card System

## Principle

Player cards are a core product system, not independent illustrations.

Cards use a **hybrid architecture**:

- fixed geometry and content anchors rendered dynamically by the application;
- interchangeable visual skins/art assets.

## Goals

- recognizable identity;
- dynamic stats;
- progression animation;
- tier changes;
- AI/Illustrator/Figma-created artwork;
- consistency across hundreds of variants;
- long-term extensibility.

## Master geometry

The product will define:

- fixed aspect ratio;
- canonical export resolution;
- safe areas;
- content anchors;
- avatar/art region;
- OVR region;
- name baseline;
- role/discipline region;
- stats grid;
- badge/tier region.

Exact pixel dimensions are selected during visual prototyping.

Once selected, the master geometry is treated as a compatibility contract.

## Fixed vs variable

### Fixed

- aspect ratio;
- safe content areas;
- primary anchors;
- stat ordering rules;
- text hierarchy;
- dynamic data positions;
- accessibility/legibility boundaries.

### Variable

- background;
- frame;
- texture;
- decorative shapes;
- tier treatment;
- special artwork;
- badges;
- event themes.

Small shape variations are allowed only if they respect safe areas and content anchors.

## Layers

Conceptual rendering stack:

```text
background skin
↓
decorative artwork
↓
avatar/player art
↓
frame/overlay
↓
dynamic content
  - OVR
  - name
  - role
  - stats
  - discipline
↓
badges/special marks
```

Exact ordering may differ per skin but dynamic content must remain readable.

## Asset contract

Card skins should be producible by:

- AI image tools;
- Illustrator;
- Figma;
- Photoshop;
- other design tools.

Assets should be exported to documented dimensions/formats and use the master template.

Potential assets:

- background;
- frame;
- overlay;
- mask;
- badge.

Prefer web-optimized formats such as WebP/PNG as appropriate.

## Dynamic stats

Values are rendered by the application.

Do not bake player-specific OVR/stats into skin images.

This enables:

- live progression;
- before/after comparison;
- localization;
- accessibility;
- responsive presentation;
- changing player data without regenerating artwork.

## Tier vs rating

Tier/card and OVR are related but separate concepts.

Some cards may be granted because of thresholds.

Special cards may be granted for:

- events;
- awards;
- milestones;
- seasons;
- future competitions.

Do not model card as a hardcoded Bronze/Silver/Gold enum that cannot expand.

## Current vs historical

Profile exposes current/equipped card.

Historical grants/milestones remain stored.

Reaching a tier is a persistent career milestone even if current rating later falls.

## Progression Reveal

Before and after cards must share geometry to allow clean animation.

Reveal can show:

- old OVR;
- old stats;
- stat deltas;
- new OVR;
- new stats;
- card/tier transition.

## Authoring template

A future master template must document:

- canvas;
- bleed;
- safe areas;
- anchor grid;
- avatar mask;
- prohibited regions;
- sample longest names;
- sample minimum/maximum numbers.

The same template is used by designers and AI-generated artwork workflows.
