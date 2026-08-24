# RATING / CONFIDENCE / PROGRESSION MODEL V1

## Status

Mathematical specification for product validation. It is not a production engine, persistence model, migration, or API contract.

The formulas and ordering below are recommended for V1. Numeric values under **Recommended V1 defaults** are calibration starting points unless explicitly marked frozen.

## Goals

- Turn raw social evidence into deterministic, explainable progression.
- Feel fair and rewarding without pretending to be a pure statistical estimator.
- Resist sparse evidence and multiplier inflation.
- Make high ratings progressively harder to improve.
- Preserve raw evidence and configuration identity so history is reproducible.
- Support pure simulation before activation.

## Non-goals

- Elo or opponent-strength estimation.
- Outlier removal, fraud scoring, confidence-based ballot invalidation, or voter weighting.
- Goalkeeper OVR.
- Rating/profile inference from self-report.
- Progression persistence, APIs, cards, tiers, achievements, or rankings.
- Retroactive recalculation after a configuration change.

## Terminology

- **Match rating**: arithmetic mean of ratings received for one target in one Match. It is not OVR.
- **Raw performance signal**: signed output of the rating curve.
- **Participation ratio**: evidence received divided by potential evaluators for that target.
- **Confidence multiplier**: continuous multiplier derived from participation ratio. It is not a probability.
- **Effective performance signal**: raw signal after confidence.
- **Progression budget**: signed potential OVR-equivalent change before attribute difficulty and caps.
- **Distribution**: normalized allocation vector over the active attribute catalog.
- **Rating profile**: stable, system-controlled weight vector used to derive OVR. It is not `preferredRole`.
- **Internal OVR**: decimal weighted result. **Display OVR** is its rounded integer representation.

## Inputs

For target `t` and Match `m`:

```text
ratingsReceived[t,m]             values 1..10 from valid ballots
eligibleEvaluatorsForTarget[t,m] played Players, excluding t when t is a Player
evaluationsReceived[t,m]         count(ratingsReceived)
strengthEvidence[t,m,a]          valid FULL STRENGTH tags for attribute a
improvementEvidence[t,m,a]       valid FULL IMPROVEMENT tags for attribute a
evaluationsWithStrengthTags      evaluations with at least one relevant strength tag
evaluationsWithImprovementTags   evaluations with at least one relevant improvement tag
beforeAttributes[a]              internal decimal values
previousStreak                   direction and consecutive qualifying count
ratingProfile                    system-controlled profile identifier
configVersion                    immutable activated configuration
```

QUICK and FULL ratings contribute identically to the arithmetic rating and participation ratio. QUICK contributes no tags. Omitted players have no evaluation and do not enter the numerator.

Only real Players receive progression state in V1. Guest evaluations remain raw Match evidence for the separately governed future linking flow; this specification does not create persistent Guest progression.

If `evaluationsReceived = 0`, `averageRating` and performance signal are undefined. Frozen V1 behavior is: `processingOutcome = NO_EVIDENCE`, no progression, and the streak does not increment, change direction, or reset. A neutral performance with actual evidence does reset the streak.

## Aggregated rating

Frozen V1 formula:

```text
averageRating = sum(ratingsReceived) / evaluationsReceived
```

No trimming, median, winsorization, outlier deletion, QUICK weighting, or FULL weighting applies in V1. Store raw evaluations permanently so a future configuration can adopt a different aggregator prospectively.

Use decimal arithmetic in a fixed order. Do not round `averageRating` for downstream calculation; round only for display and snapshots at the configured storage precision.

## Rating curve

Use a configurable monotone piecewise-linear curve `R(x)` over rating points. For decimal averages, interpolate between adjacent control points:

```text
R(x) = y0 + (y1 - y0) × (x - x0) / (x1 - x0)
```

where `(x0,y0)` and `(x1,y1)` bracket `x`.

Recommended starting curve:

| Average | Signal |
| ---: | ---: |
| 1 | -1.00 |
| 2 | -0.90 |
| 3 | -0.75 |
| 4 | -0.50 |
| 5 | -0.20 |
| 6 | 0.00 |
| 7 | +0.20 |
| 8 | +0.50 |
| 9 | +0.80 |
| 10 | +1.00 |

Frozen semantics: rating `6` is neutral. The exact non-neutral points are starting defaults.

## Participation confidence

Confidence is target-specific:

```text
participationRatio = evaluationsReceived / eligibleEvaluatorsForTarget
```

The denominator is frozen as:

- Player target: all played Players except self.
- Guest target: all played Players.
- Observer status has no effect.

Clamp the ratio to `[0,1]` defensively. Derive multiplier `C(p)` by piecewise-linear interpolation:

| Participation | Multiplier |
| ---: | ---: |
| 0% | 0.00 |
| 25% | 0.45 |
| 50% | 0.75 |
| 75% | 1.00 |
| 100% | 1.20 |

This deliberately rewards complete evidence slightly above baseline without making sparse evidence worthless. It avoids hard 25/50/75 percent cliffs.

## Effective performance signal

```text
rawPerformanceSignal       = R(averageRating)
participationMultiplier    = C(participationRatio)
effectivePerformanceSignal = rawPerformanceSignal × participationMultiplier
```

The sign is preserved. With the starting curve, the effective range is `[-1.20,+1.20]`. Clamp to the configured curve-product bounds only as defensive validation, not as an additional normalization.

## OVR bands

The band is selected from `beforeOVR`, never from a partially updated value.

| Before OVR | Positive multiplier | Negative multiplier |
| --- | ---: | ---: |
| `< 70` | 1.40 | 0.60 |
| `70–79.999…` | 1.10 | 0.80 |
| `80–89.999…` | 0.80 | 0.80 |
| `≥ 90` | 0.45 | 0.80 |

Separate positive/negative curves are frozen conceptually. These values are starting defaults. Negative severity stops increasing after 70–79; ratings above 90 do not become progressively more destructive.

Band boundaries may create a small change at the boundary. This is acceptable for V1 because OVR is stored with precision and the band is selected once per Match. A future config may replace bands with a continuous curve without changing the processing contract.

## Streaks

State:

```text
direction = POSITIVE | NEGATIVE | NONE
qualifyingCount >= 0
```

Recommended qualification defaults:

```text
effectivePerformanceSignal >= +0.35 → POSITIVE qualifier
effectivePerformanceSignal <= -0.35 → NEGATIVE qualifier
otherwise                              neutral
```

Update before calculating the current Match's streak multiplier:

1. Same qualifying direction: increment count.
2. Opposite qualifying direction: replace direction and set count to 1.
3. Neutral evidence: reset to `NONE/0`.
4. No evidence: preserve state exactly and do not increment.

| Qualifying count | Multiplier |
| ---: | ---: |
| 0–2 | 1.00 |
| 3 | 1.10 |
| 4 | 1.15 |
| 5+ | 1.20 |

A positive streak multiplier applies only to a positive budget; a negative streak multiplier only to a negative budget. The cap prevents unbounded compounding.

## Progression budget

Calculate performance before attribute allocation:

```text
signMultiplier =
  effectivePerformanceSignal > 0 ? positiveOVRBandMultiplier :
  effectivePerformanceSignal < 0 ? negativeOVRBandMultiplier : 0

progressionBudget =
  effectivePerformanceSignal
  × baseOVREquivalentScale
  × signMultiplier
  × streakMultiplier
```

Recommended `baseOVREquivalentScale = 0.80`.

The budget is an OVR-equivalent potential at attribute difficulty `1.0`. It is not persisted as OVR and is never added directly to OVR.

## F5 attributes

Frozen active V1 field catalog:

```text
VELOCIDAD
PASE
REGATE
REMATE
DEFENSA
FISICO
```

Attribute range is frozen to `[1,99]`. Internal values retain configured decimal precision; UI displays integers. The config owns the active catalog so future disciplines or field models can use different attributes without altering `Player` identity.

Goalkeeper progression is excluded. It requires a separate catalog such as `REFLEJOS`, `SEGURIDAD`, `SALIDAS`, `1V1`, and `JUEGO_CON_PIES`. Field attributes must not be reused to fabricate goalkeeper OVR.

## Profiles

Recommended starting weight vectors, each summing exactly `1.0` and assigning non-zero weight to every field attribute:

| Profile | VEL | PAS | REG | REM | DEF | FIS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| LIBRE | 0.166667 | 0.166667 | 0.166667 | 0.166667 | 0.166666 | 0.166666 |
| DEFENSIVO | 0.15 | 0.18 | 0.10 | 0.07 | 0.30 | 0.20 |
| MEDIO | 0.15 | 0.25 | 0.20 | 0.12 | 0.18 | 0.10 |
| OFENSIVO | 0.20 | 0.12 | 0.25 | 0.25 | 0.06 | 0.12 |

The implementation must validate the sum within a strict decimal tolerance and normalize only during configuration publication, never silently during historical processing.

### Canonical OVR policy

Frozen conceptual rule:

```text
preferredRole != ratingProfile
canonicalOVR = OVR(ratingProfile)
```

`ratingProfile` is stable and system-controlled. The user cannot freely switch it to maximize OVR. Bootstrap V1 may initialize it as `LIBRE`, while configuration and snapshots must support a future auditable transition to `DEFENSIVO`, `MEDIO`, or `OFENSIVO`. Such a transition affects future derivation only and never reinterprets historical snapshots. Profile inference and transition policy are not defined in this specification.

## OVR derivation

For profile `p`:

```text
OVR_p(attributes) = Σ attributes[a] × profileWeight[p,a]
```

Compute and store internal OVR using fixed decimal precision. Recommended display rule:

```text
displayOVR = round-half-up(internalOVR, 0)
```

Never use display OVR in calculations. OVR is always re-derived after attribute updates; it is not an independently progressed field.

## Tag distribution

Tags are raw human evidence:

```text
tag != direct attribute delta
```

Choose evidence by budget sign:

- Positive budget: use only STRENGTH tags.
- Negative budget: use only IMPROVEMENT tags.
- Zero budget: no distribution or attribute change.

For the applicable sign:

```text
tagCoverage = evaluationsWithAtLeastOneApplicableTag / evaluationsReceived
```

QUICK evaluations remain in the denominator and contain no tags. If no evaluation supplied applicable tags, coverage is zero.

Count each distinct attribute tag once per evaluation. Then:

```text
tagDistribution[a] = tagCount[a] / Σ tagCount
```

If the sum is zero, use no tag distribution.

The base distribution is the canonical rating-profile weight vector. Recommended blend:

```text
tagBlend          = clamp(tagCoverage × maxTagBlend, 0, maxTagBlend)
maxTagBlend       = 0.75
finalDistribution = normalize(
  baseDistribution × (1 - tagBlend)
  + tagDistribution × tagBlend
)
```

Thus no tags gives exactly the base distribution; partial tags influence gradually; even unanimous tags retain 25% profile prior. This limits coordinated tag concentration without discarding evidence.

## Attribute difficulty

Use separate monotone piecewise-linear curves by current attribute value.

Recommended positive curve:

| Current attribute | Multiplier |
| ---: | ---: |
| 1 | 1.00 |
| 69 | 1.00 |
| 79 | 0.85 |
| 89 | 0.65 |
| 94 | 0.40 |
| 99 | 0.20 |

Recommended negative curve:

| Current attribute | Multiplier |
| ---: | ---: |
| 1 | 0.35 |
| 60 | 0.55 |
| 70 | 0.70 |
| 80 | 0.85 |
| 90 | 1.00 |
| 99 | 1.00 |

The negative curve protects already-low attributes from collapsing while not making high players immune to recurring negative evidence.

### Attribute delta formula

Let `d[a]` be final distribution, `w[a]` canonical OVR weights, and `D[a]` difficulty. Define a profile normalization independent of difficulty:

```text
profileSensitivity = Σ w[a] × d[a]

candidateDelta[a] =
  progressionBudget
  × d[a]
  × D[a]
  / profileSensitivity
```

This makes `progressionBudget` comparable across profiles at difficulty `1.0`, while high attributes genuinely reduce realized OVR movement. Concentrating evidence on a low-weight attribute cannot inflate OVR because profile sensitivity, attribute caps, and the final OVR cap all still apply.

## Caps

Apply safeguards in this exact order:

1. Compute candidate deltas from the frozen before-state.
2. Clamp each delta to its sign/band `maxAttributeDelta`.
3. Clamp resulting attributes to `[1,99]`; lost budget is not redistributed.
4. Derive candidate after-OVR from capped attributes.
5. If absolute derived OVR delta exceeds the sign/band OVR cap, multiply every already-capped delta by:

```text
scale = allowedOVRDelta / abs(candidateOVRDelta)
```

6. Recompute attributes and OVR once. Scaling only downward preserves all prior caps and produces an exact proportional result because OVR is linear in attributes.

Recommended starting caps:

| Before OVR | Max +OVR | Max -OVR | Max +attribute | Max -attribute |
| --- | ---: | ---: | ---: | ---: |
| `<70` | 1.20 | 0.60 | 1.50 | 0.80 |
| `70–79` | 0.90 | 0.70 | 1.20 | 0.90 |
| `80–89` | 0.60 | 0.70 | 0.90 | 0.90 |
| `90+` | 0.35 | 0.70 | 0.60 | 0.90 |

Do not redistribute clipped budget. Redistribution would let one saturated/tagged attribute push unrelated attributes and would make explanations harder.

## Snapshot

Every processed target/Match must retain at least:

```text
playerId / guest evidence identity as applicable
matchId
discipline
beforeAttributes
afterAttributes
attributeDeltas
beforeOVR
afterOVR
ovrDelta
evaluationsReceived
eligibleEvaluatorsForTarget
aggregatedRating | null
participationRatio
confidenceMultiplier
rawPerformanceSignal
effectivePerformanceSignal
streakBefore
streakAfter
streakMultiplier
progressionBudget
baseDistribution
tagCoverage
tagDistribution
finalDistribution
configVersionId
processedAt supplied by caller
processingOutcome = APPLIED | NEUTRAL | NO_EVIDENCE
```

Snapshots are immutable historical explanations. Raw ballots remain the source evidence, but an activated config change never recalculates an existing snapshot automatically.

## Config versioning

`ProgressionConfigVersion` is an immutable validated data document containing primitives only:

- semantic version/identifier;
- `activatedAt` or `effectiveFrom`;
- active discipline and attribute catalog;
- rating curve;
- participation-confidence curve;
- OVR bands and sign multipliers;
- streak thresholds, steps, and cap;
- base progression scale;
- per-band attribute and OVR caps;
- profile weight vectors and canonical profile policy;
- tag blend limit;
- positive and negative attribute-difficulty curves;
- attribute range and calculation/storage precision.

Validation must guarantee ordered curve inputs, finite values, monotonicity where required, exact profile sums, valid caps, non-overlapping bands, and a known attribute key set. Configuration is data, never executable formulas or arbitrary code.

At processing start, resolve exactly one active version by effective time and store its ID in the snapshot. A later activation affects only matches processed with that later version.

## Simulation

Required pure conceptual function:

```text
simulateProgression(
  initialPlayerState,
  orderedMatchEvidenceSequence,
  configVersion
) -> MatchProgressionStep[]
```

Rules:

- no persistence, network, random values, or ambient clock;
- Match sequence order is explicit input;
- `processedAt` is metadata supplied by the caller and does not affect math;
- every step consumes the exact previous step's internal attributes/streak;
- same input and config bytes produce identical decimal outputs.

Recommended engine arithmetic is fixed-precision decimal with a documented scale (at least 6 decimal places), fixed iteration order from the configured attribute list, and round-half-up only at snapshot serialization/display boundaries. IEEE floating-point prototypes are acceptable for exploration, not the historical engine contract.

## Scenarios

The following exploratory calculations use all attributes equal, canonical `LIBRE`, rating/confidence/default curves above, no tags unless specified, and apply streak on the third qualifying Match. Values are approximate because this document does not prescribe a production decimal library.

| Scenario | Inputs | Approximate result |
| --- | --- | --- |
| A | OVR 60, ten rating-9 matches, 75% participation | `60 → 70.26`; per-Match OVR deltas approximately `+0.90,+0.90,+0.99,+1.03,+1.08…`; crosses 70 after about 10 matches and then slows. |
| B | OVR 60, ten neutral rating-6 matches, 75% | `60 → 60`; no budget, streak remains neutral. |
| C | OVR 80, same evidence as A | `80 → 84.62`; roughly 22 excellent matches would be required to approach 90 if conditions stayed similar, with further slowing from difficulty. |
| D | OVR 92, same evidence as A | `92 → 93.53`; roughly 6–7 such matches per OVR point initially, increasingly more near 95/99. |
| E | OVR 60, three rating-3 matches, 75% | deltas about `-0.20,-0.20,-0.22`; negative streak activates on Match 3; `60 → 59.39`. |
| F | OVR 60, three rating-9 matches, 75% | `+0.90,+0.90,+0.99`; positive streak activates on Match 3; `60 → 62.78`. |
| G | OVR 60, rating 10, 1 of 8 evaluators | participation `12.5%`, confidence `0.225`, effective signal `0.225`; approximately `+0.25 OVR`, no streak qualifier. |
| H | OVR 60, rating 9, 100% participation | confidence `1.20`, effective signal `0.96`; approximately `+1.08 OVR`, below the `+1.20` cap. |
| I | All evidence QUICK | `tagCoverage=0`; progression uses profile base distribution and remains fully functional. |
| J | 70% of evaluations contain applicable tags, all concentrated on REMATE | `tagBlend=0.525`; REMATE distribution ≈ `60.4%`, each other attribute ≈ `7.9%`; REMATE hits its per-attribute cap first and clipped budget is not redistributed. |

### Approximate progression pace

Under consistently excellent rating-9/75% evidence:

- A genuinely under-rated OVR-60 player reaches about 70 in 10 matches.
- Starting at 70, comparable evidence is expected to add roughly `0.6–0.9` OVR per Match initially, then slow with attribute difficulty.
- Starting at 80, ten excellent matches add about 4.6 OVR.
- Starting at 92, ten excellent matches add about 1.5 OVR.
- Neutral performance produces no inflation.

These are calibration hypotheses, not product promises. Real mixed ratings, partial tags, caps, profile distributions, and changing participation will lower or vary the pace.

## Sensitivity analysis

| Parameter | Increase | Decrease | Too high | Too low |
| --- | --- | --- | --- | --- |
| Confidence curve | Sparse/full evidence moves more | Evidence is damped | One or two voters can swing players; 100% participation over-amplifies | Voting feels irrelevant; even consensus barely moves |
| Base scale | Faster progression and decline | Slower system | Inflation/volatility; caps trigger constantly | Flat progression; reveal rarely matters |
| Streak multipliers | Stronger momentum | Flatter sequence effects | Multiplicative runaway and social punishment | Streak feature is imperceptible |
| Positive OVR-band multiplier | Faster upward mobility in that band | Harder climbing | High ratings become common | Players get stuck, especially at cold start |
| Negative OVR-band multiplier | Faster decline | More protection | A few bad matches erase long progress | Negative evidence has no credibility |
| `maxTagBlend` | Tags steer attributes more | Profile prior dominates | Coordinated tags over-specialize players | Detailed FULL evidence feels cosmetic |
| Positive difficulty curve | High attributes rise more easily | Stronger diminishing returns | 99 becomes routine | Attributes freeze too early |
| Negative difficulty curve | More loss at affected values | More protection | Low attributes collapse | Weakness evidence never changes stats |
| Attribute caps | More concentrated per-match movement | Smoother stats | One Match creates implausible stat jumps | Tags cannot visibly influence attributes |
| OVR caps | Larger visible Match swings | Lower volatility | `+5 OVR`-style inflation/destruction | Progression budget is constantly discarded |
| Streak thresholds | Fewer streaks | More streaks | Momentum is almost unreachable | Ordinary noise becomes a streak |

## Avoiding multiplier explosion

The only multiplicative chain before allocation is:

```text
bounded rating signal
× bounded confidence
× one sign-specific OVR-band multiplier
× bounded streak multiplier
× base scale
```

Controls:

1. Every curve and multiplier has validated finite bounds.
2. Positive and negative band multipliers are mutually exclusive, never multiplied together.
3. Streak is capped at `1.20`.
4. Attribute difficulty is at most `1.0`; it cannot amplify.
5. Tag distribution reallocates budget but never increases it.
6. Per-attribute caps apply before the derived-OVR cap.
7. The final OVR cap proportionally scales deltas downward.
8. Monitoring should report how often caps trigger. Frequent cap activation means defaults are miscalibrated, not that caps should simply be raised.

## Open decisions

Require product validation before implementation freeze:

1. How and when the system may transition `ratingProfile` after bootstrap.
2. Whether initial attributes are all exactly 60 or have a bounded bootstrap shape.
3. Final numeric calibration for curves, scales, thresholds, caps, and tag blend.
4. Whether negative and positive streak thresholds should remain symmetric.
5. Exact fixed-decimal scale and rounding policy used by persistence.
6. How a future goalkeeper profile coexists with field participation and display OVR.
7. Whether a voided ballot causes deterministic reprocessing before or after a snapshot has been published; this must not mutate old snapshots silently.

## Recommended V1 defaults

### Decisions ready to freeze

- Arithmetic mean of raw valid ratings; no outlier removal.
- Rating 6 is neutral.
- Continuous piecewise-linear rating and participation curves.
- Target-specific participation denominator with Player self-exclusion.
- `effectiveSignal = ratingSignal × participationMultiplier`.
- Separate positive/negative OVR-band multipliers.
- Streak begins on the third qualifying performance and is capped.
- No-evidence Matches preserve streak state without incrementing; neutral evidence resets it.
- OVR is derived only from attributes.
- Attributes range from 1 to 99 with internal decimals.
- Six active F5 field attributes; goalkeeper excluded.
- Tags distribute budget and never create direct deltas.
- Positive budgets use strengths; negative budgets use improvements.
- No-tags evidence falls back to profile distribution.
- Caps apply per attribute, then proportionally on derived OVR.
- Configuration and snapshots are immutable/versioned/prospective.
- Pure deterministic simulation is mandatory before activation.
- `preferredRole` never controls OVR; canonical OVR uses stable system-controlled `ratingProfile`.

### Starting calibration values, not frozen product truth

- Rating curve values shown above.
- Confidence points `0→0`, `.25→.45`, `.50→.75`, `.75→1`, `1→1.20`.
- OVR band multipliers `1.40/0.60`, `1.10/0.80`, `0.80/0.80`, `0.45/0.80`.
- Streak thresholds `±0.35`; multipliers `1.10`, `1.15`, `1.20`.
- Base OVR-equivalent scale `0.80`.
- `maxTagBlend=0.75`.
- Difficulty curves and caps in this document.
- Profile weights in this document.

### Initial attributes recommendation

The next implementation slice needs an explicit bootstrap decision. Safest V1 default:

```text
all six field attributes = 60.000000
canonical profile = LIBRE
canonical internal OVR = 60.000000
```

Self-report should inform matchmaking and preferred role only, not competitive attributes. If product validation requires a shaped initial card, the shape must be configuration-defined, bounded (for example 55–65), normalize to exactly canonical OVR 60, and be snapshotted as bootstrap provenance. It must not allow a user to select the profile yielding the highest number.

Match count is not a progression multiplier. A Player at OVR 60 uses the same OVR curve whether the player has 2 or 80 prior Matches; age and experience do not create hidden slowdown.

This recommendation prevents self-report from becoming competitive evidence, guarantees initial OVR 60 for every profile when all attributes are equal, and leaves later evidence to create differentiation.
