# PROGRESSION CALIBRATION V1

## Status

Exploratory product calibration for `RATING_CONFIDENCE_PROGRESSION_MODEL_V1.md`. This is not a production engine, schema, migration, API, or activated configuration. Results come from `scripts/progression-calibration-v1.mjs`, which mirrors the current starting defaults using JavaScript floating-point arithmetic.

Internal OVR is shown to six decimals and display OVR uses round-half-up. Unless stated otherwise, simulations start with all six attributes at `60`, use `ratingProfile=LIBRE`, have no tags, and receive evidence in every simulated Match.

## Current defaults

- Rating curve: `1→-1.00`, `2→-0.90`, `3→-0.75`, `4→-0.50`, `5→-0.20`, `6→0`, `7→+0.20`, `8→+0.50`, `9→+0.80`, `10→+1.00`, with linear interpolation.
- Confidence: `0%→0`, `25%→0.45`, `50%→0.75`, `75%→1.00`, `100%→1.20`, with linear interpolation.
- Base OVR-equivalent scale: `0.80`.
- Positive/negative OVR-band multipliers: `<70 1.40/0.60`; `70–79 1.10/0.80`; `80–89 0.80/0.80`; `90+ 0.45/0.80`.
- Streak threshold: effective signal `>=+0.35` or `<=-0.35`; multipliers `3→1.10`, `4→1.15`, `5+→1.20`.
- No evidence: `NO_EVIDENCE`, zero progression, streak preserved exactly. Neutral evidence resets streak.
- Tag blend: `tagCoverage × 0.75`, capped at `0.75`.
- Attribute range: `1..99`; positive and negative difficulty curves and per-band caps are those in the mathematical spec.
- Canonical OVR: `OVR(ratingProfile)`. `preferredRole` is independent. Bootstrap may use `LIBRE`; future profile changes must be system-controlled and auditable.

## Long-run scenarios

All scenarios use 75% participation for 50 consecutive Matches.

| Scenario | Rating | M0 internal/display | M5 | M10 | M20 | M30 | M40 | M50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — Excelente | 8.5 | 60.000000 / 60 | 63.967600 / 64 | 68.335600 / 68 | 75.291579 / 75 | 80.910040 / 81 | 84.785235 / 85 | 88.290458 / 88 |
| B — Muy bueno | 8.0 | 60.000000 / 60 | 63.052000 / 63 | 66.412000 / 66 | 72.477332 / 72 | 77.307278 / 77 | 81.283826 / 81 | 84.267843 / 84 |
| C — Bueno | 7.2 | 60.000000 / 60 | 61.456000 / 61 | 62.912000 / 63 | 65.824000 / 66 | 68.736000 / 69 | 71.299916 / 71 | 73.475176 / 73 |
| D — Correcto+ | 6.2 | 60.000000 / 60 | 60.224000 / 60 | 60.448000 / 60 | 60.896000 / 61 | 61.344000 / 61 | 61.792000 / 62 | 62.240000 / 62 |
| E — Neutral | 6.0 | 60.000000 / 60 | 60.000000 / 60 | 60.000000 / 60 | 60.000000 / 60 | 60.000000 / 60 | 60.000000 / 60 | 60.000000 / 60 |
| F — Flojo | 5.0 | 60.000000 / 60 | 59.736172 / 60 | 59.472773 / 59 | 58.947258 / 59 | 58.423452 / 58 | 57.901347 / 58 | 57.380939 / 57 |
| G — Malo | 4.0 | 60.000000 / 60 | 59.281873 / 59 | 58.494917 / 58 | 56.932487 / 57 | 55.385243 / 55 | 53.853039 / 54 | 52.335728 / 52 |

Interpretation:

- A merely good `7.2` does not inevitably reach 90+: it ends near 73 after 50 consistently good Matches.
- Sustained `8.0` reaches 80 after roughly 37 Matches and ends near 84.
- Sustained `8.5` reaches 80 after roughly 29 Matches but still ends below 90 after 50. Under these clean assumptions, 90+ remains extraordinary.
- Rating `6.2` creates slow positive drift of `+2.24` over 50 Matches. This is small but should be validated: product may regard “slightly above correct” as legitimate progress or as excessive ambient inflation.
- Neutral `6` is exactly stable. Negative progression is deliberately gentler below 70: 50 straight rating-4 Matches remove about 7.66 OVR rather than destroying the player.

## Sparse evidence

| Evidence repeated for 20 Matches | Confidence | M0 | M5 | M10 | M20 | Total change |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rating 10, 1/8 evaluators | 0.225 | 60.000000 | 61.260000 | 62.520000 | 65.040000 | +5.040000 |
| Rating 9, 2/8 evaluators | 0.450 | 60.000000 | 62.197440 | 64.616640 | 69.455040 | +9.455040 |

Neither sequence qualifies for a streak at its effective signal, so the accumulation comes entirely from repeated small budgets. One vote out of eight is protected per Match, but 20 repeated sparse extremes still produce five OVR. Two of eight rating-9 votes almost produce ten OVR. That is the strongest calibration risk found: evidence scarcity is damped, not bounded across Matches.

The model should not discard sparse evidence or add a hard quorum, but the low-participation confidence segment should be lowered before production experiments.

## Participation sensitivity

Rating `8.5` repeated for 20 Matches:

| Participation | Confidence multiplier | Final internal OVR | Display | Change |
| ---: | ---: | ---: | ---: | ---: |
| 12.5% | 0.225 | 63.276000 | 63 | +3.276000 |
| 25% | 0.450 | 66.552000 | 67 | +6.552000 |
| 50% | 0.750 | 72.177227 | 72 | +12.177227 |
| 75% | 1.000 | 75.291579 | 75 | +15.291579 |
| 100% | 1.200 | 77.679112 | 78 | +17.679112 |

The curve is monotone and smooth. Full participation is meaningful without doubling the 75% outcome. The `0–25%` segment is comparatively permissive over repeated Matches and deserves calibration.

## Reversibility

Starting from six uniform attributes at OVR 80; excellent means rating `8.5`, bad means rating `4`, both at 75% participation.

| Match | Excellent ×5 then bad ×5 | Bad ×5 then excellent ×5 |
| ---: | ---: | ---: |
| 0 | 80.000000 | 80.000000 |
| 1 | 80.345280 | 79.728000 |
| 2 | 80.687687 | 79.457306 |
| 3 | 81.061202 | 79.160971 |
| 4 | 81.448120 | 78.852802 |
| 5 | 81.847998 | 78.533010 |
| 6 | 81.567128 | 79.023217 |
| 7 | 81.287605 | 79.509151 |
| 8 | 80.981607 | 80.037564 |
| 9 | 80.663388 | 80.434277 |
| 10 | 80.333167 | 80.844277 |

Order matters because crossing below 80 changes the positive band from `0.80` to `1.10`, and each five-Match block develops its own streak. This produces moderate hysteresis, not an extreme one: the two final states differ by `0.511110`. The boundary effect should remain visible in simulation tests even if future defaults replace bands with continuous curves.

## Streaks

- `++`, `NO_EVIDENCE`, `+`: after the first two positives the state is `POSITIVE/2`; the no-evidence Match remains `POSITIVE/2` with no OVR change; the next observed positive becomes count 3 and uses `1.10`. The third positive **observed** activates the streak.
- `++`, neutral-with-evidence, `+`: the neutral Match resets to `NONE/0`; the next positive is `POSITIVE/1` and uses `1.00`.
- Eight positives use multipliers `1.00, 1.00, 1.10, 1.15, 1.20, 1.20, 1.20, 1.20`.
- Eight negatives use the same capped sequence. The multiplier stops growing after count 5 in both directions.

This validates the frozen difference between absence of evidence and neutral evidence.

## Profiles

Profile comparison uses the same attributes with each configured weight vector; values are internal OVR.

| Conceptual player | Attributes VEL/PAS/REG/REM/DEF/FIS | LIBRE | DEFENSIVO | MEDIO | OFENSIVO |
| --- | --- | ---: | ---: | ---: | ---: |
| Attacker | 95/85/95/99/24/63 | 76.833400 | 65.780000 | 77.000000 | 86.700000 |
| Specialized defender | 72/78/58/52/94/88 | 73.666632 | 80.080000 | 73.860000 | 67.460000 |
| Balanced midfielder | 78/92/86/74/76/80 | 81.000006 | 80.840000 | 82.460000 | 80.800000 |

The vectors reward the intended specialization while remaining on a comparable 1–99 scale. The attacker’s 20.92-point spread between defensive and offensive profiles demonstrates why `preferredRole` cannot select canonical OVR. The midfielder remains close across profiles, as expected from a balanced shape. These examples validate the shape, not which profile any player should receive.

## Tag sensitivity

Ten identical rating-8.5 Matches at 75% participation, all applicable tags concentrated on `REMATE`:

| Coverage | ΔVEL | ΔPAS | ΔREG | ΔREM | ΔDEF | ΔFIS | Final OVR | Attribute cap hits | OVR cap hits | Discarded budget |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0% | +8.335617 | +8.335617 | +8.335617 | +8.335617 | +8.335567 | +8.335567 | 68.335600 | 0 | 0 | 0.000000 |
| 25% | +6.772686 | +6.772686 | +6.772686 | +14.821001 | +6.772645 | +6.772645 | 68.114061 | 8 | 0 | 0.185728 |
| 50% | +5.209757 | +5.209757 | +5.209757 | +15.000000 | +5.209725 | +5.209725 | 66.841457 | 10 | 0 | 1.437632 |
| 75% | +3.646828 | +3.646828 | +3.646828 | +15.000000 | +3.646806 | +3.646806 | 65.539020 | 10 | 0 | 2.721641 |
| 100% | +2.083901 | +2.083901 | +2.083901 | +15.000000 | +2.083889 | +2.083889 | 64.236584 | 10 | 0 | 4.005650 |

Concentrated tags correctly specialize progression and never increase total OVR. However, from 50% coverage onward `REMATE` hits its `+1.5` cap in every Match; at 25% it hits in 8/10. Because clipped budget is deliberately not redistributed, higher tag coverage substantially lowers realized OVR. This is safe against inflation but may make detailed FULL evidence feel punitive compared with QUICK/no-tag evidence.

## Cap telemetry

| Scenario family | Attribute cap hits | OVR cap hits | Discarded budget | Assessment |
| --- | ---: | ---: | ---: | --- |
| Long-run A–G, each 50 Matches | 0 each | 0 each | 0 each | Caps are not driving ordinary uniform progression. |
| Sparse evidence, each 20 Matches | 0 | 0 | 0 | Sparse accumulation is caused by confidence defaults, not caps. |
| Participation sensitivity, each 20 Matches | 0 | 0 | 0 | Smooth curve behavior is not cap-distorted. |
| Reversibility, each 10 Matches | 0 | 0 | 0 | Direction/order effects come from bands and streaks. |
| Tags 0% | 0 | 0 | 0 | Base distribution is unconstrained. |
| Tags 25% | 8 | 0 | 0.185728 | Concentrated attribute begins saturating frequently. |
| Tags 50–100% | 10 each | 0 | 1.437632–4.005650 | Constant attribute saturation is a calibration warning. |

No OVR cap activated in this matrix. That is not evidence the OVR cap is unnecessary: these scenarios did not combine the most extreme rating, 100% confidence, low OVR, and an already-active streak. It remains a safety invariant and needs targeted boundary tests in the future engine test vector.

`discardedBudget` is measured in canonical OVR-equivalent movement lost after attribute/range and derived-OVR caps. It is not redistributed.

## Inflation risks

- A consistently good rating `7.2` ends at 73, not 90; ordinary good play is not inherently inflationary under the tested defaults.
- Very good/excellent evidence can create strong long-run advancement, but difficulty and OVR bands keep 50 Matches below 90 from a start of 60.
- The main inflation risk is repeated sparse extreme evidence. Per-Match damping alone does not prevent cumulative +5 to +9.5 OVR across 20 Matches.
- Rating `6.2` adds +2.24 over 50 Matches. At population scale, any mean rating above 6 creates systemic positive drift unless balanced by sub-6 evidence. This is a product-calibration question, not a formula defect.
- Streak multiplication is capped and did not cause cap activation in long runs. It is not currently the dominant inflation source.
- Concentrated tags cause the opposite risk: discarded progression and lower canonical OVR than equivalent QUICK evidence.

## Recommended adjustments

These are explicit proposals for a later configuration decision. They do **not** modify the mathematical spec or current defaults.

| Parameter | Current | Proposed experiment | Reason | Expected effect |
| --- | --- | --- | --- | --- |
| Low-participation confidence | Linear `0→0`, `25%→0.45` (thus 12.5%→0.225) | Add control point `12.5%→0.10`; test `25%→0.30` | Twenty repeated sparse extremes create +5.04 and +9.46 OVR | Preserve non-zero evidence while roughly halving movement at 1/8 and reducing 2/8 accumulation by one third. |
| Maximum tag blend | `0.75` | Compare `0.50` | 50–100% concentrated coverage caps the attribute in every Match and discards 1.44–4.01 OVR-equivalent | Retain specialization while reducing the penalty for supplying detailed evidence. |
| Concentrated-budget handling | Discard all clipped budget | Keep current behavior for V1; test a bounded residual-to-base blend later, never unrestricted redistribution | Discarding is safe but FULL evidence can progress materially less than QUICK | A bounded alternative could reduce modality bias without letting a saturated tag inflate unrelated attributes. Requires product review before adoption. |
| Rating curve near neutral | `6→0`, `7→0.20` (thus 6.2→0.04) | Keep initially; separately test `7→0.15` | Correcto+ creates +2.24 over 50 Matches | Would reduce ambient drift while preserving strict neutrality at 6; risk is making merely good play feel flat. |

No proposal raises a cap. Constant tag cap hits are treated as evidence to adjust distribution influence, not permission to allow implausible per-attribute jumps.

## Parameters safe to freeze

- `evaluationsReceived=0` produces `NO_EVIDENCE`, no progression, and exact streak preservation.
- Neutral evidence resets streak.
- Arithmetic mean with raw evidence retained.
- Rating 6 as neutral.
- Target-specific participation denominator and self-exclusion.
- Deterministic piecewise-linear curves stored as configuration data.
- OVR derived from attributes, never progressed independently.
- `preferredRole != ratingProfile`; canonical OVR uses stable system-controlled `ratingProfile`.
- Bootstrap may begin with `ratingProfile=LIBRE`, without freezing LIBRE permanently.
- Tags are raw evidence and only distribute budget; no direct attribute deltas.
- No-tags/QUICK fallback to base profile distribution.
- Sign-specific tag semantics.
- Attribute bounds `1..99`, fixed ordering, no randomness.
- Per-attribute caps followed by proportional derived-OVR cap; clipped budget is not silently redistributed under the current V1 contract.
- Versioned immutable config and historical snapshots.

## Parameters requiring real-user calibration

- Every non-neutral rating-curve point, especially the `6–8` region.
- Confidence values below 50% participation and the 100% bonus.
- Base progression scale and OVR-band multipliers.
- Positive/negative streak thresholds and multipliers.
- Positive/negative attribute-difficulty curves.
- Per-band attribute and OVR cap values and acceptable cap-hit rate.
- Maximum tag blend and whether concentrated tag evidence should lose some budget.
- Profile weights and the future policy for auditable `ratingProfile` transitions.
- Initial attribute shape beyond the safe uniform-60 bootstrap.
- Fixed-decimal precision and persistence rounding.
- Acceptable time-to-70/80/90 based on real Match frequency and observed voting distributions.

The current defaults are suitable for implementing a deterministic simulator behind a feature flag, but the sparse-confidence and concentrated-tag behaviors should be tested with real ballot distributions before activation as product truth.
