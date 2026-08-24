# PROGRESSION CALIBRATION V1.1

## Scope

This document calibrates parameters of the accepted model in `RATING_CONFIDENCE_PROGRESSION_MODEL_V1.md`. It does not change the mathematical architecture, activate configuration, or define a production engine, persistence model, schema, migration, API, or `PlayerPerformance`.

Results are deterministic outputs from `scripts/progression-calibration-v1.mjs`. The script uses JavaScript floating-point arithmetic for exploration; a future historical engine still requires the fixed-decimal contract defined by the main specification.

All OVR values are internal decimals rounded to six places for reporting. Simulations start from six uniform attributes unless another starting OVR is stated. Default profile is `LIBRE`, participation is 75%, and tags are absent unless specified.

## Frozen model assumptions

The following remain unchanged:

- arithmetic average rating;
- rating curve followed by target-specific participation confidence;
- rating 6 is neutral;
- effective signal, OVR-band multiplier, capped streak multiplier, then progression budget;
- base/tag distribution followed by attribute difficulty and caps;
- OVR is derived from attributes;
- tags are raw distributive evidence, never direct deltas;
- `preferredRole != ratingProfile` and `canonicalOVR = OVR(ratingProfile)`;
- `NO_EVIDENCE` preserves streak without incrementing; neutral evidence resets it;
- deterministic, versioned, prospective configuration.

V1 and V1.1 remain separate: the values below are recommendations, not silent edits to the main specification.

## Confidence experiments

Curves compared with the same piecewise-linear interpolation:

| Curve | Control points |
| --- | --- |
| Current | `0→0`, `25%→0.45`, `50%→0.75`, `75%→1.00`, `100%→1.20` |
| Moderate | `0→0`, `12.5%→0.10`, `25%→0.25`, `50%→0.70`, `75%→1.00`, `100%→1.20` |
| Conservative | `0→0`, `12.5%→0.05`, `25%→0.20`, `50%→0.65`, `75%→1.00`, `100%→1.20` |

Each case runs for 20 Matches from OVR 60.

| Curve | Evidence | Multiplier | Initial | Final | Total delta |
| --- | --- | ---: | ---: | ---: | ---: |
| Current | rating 10, 1/8 | 0.225 | 60 | 65.040000 | +5.040000 |
| Moderate | rating 10, 1/8 | 0.100 | 60 | 62.240000 | +2.240000 |
| Conservative | rating 10, 1/8 | 0.050 | 60 | 61.120000 | +1.120000 |
| Current | rating 9, 2/8 | 0.450 | 60 | 69.455040 | +9.455040 |
| Moderate | rating 9, 2/8 | 0.250 | 60 | 64.480000 | +4.480000 |
| Conservative | rating 9, 2/8 | 0.200 | 60 | 63.584000 | +3.584000 |
| Current | rating 8.5, 25% | 0.450 | 60 | 66.552000 | +6.552000 |
| Moderate | rating 8.5, 25% | 0.250 | 60 | 63.640000 | +3.640000 |
| Conservative | rating 8.5, 25% | 0.200 | 60 | 62.912000 | +2.912000 |
| Current | rating 8.5, 50% | 0.750 | 60 | 72.177227 | +12.177227 |
| Moderate | rating 8.5, 50% | 0.700 | 60 | 71.518165 | +11.518165 |
| Conservative | rating 8.5, 50% | 0.650 | 60 | 70.953203 | +10.953203 |
| All three | rating 8.5, 75% | 1.000 | 60 | 75.291579 | +15.291579 |
| All three | rating 8.5, 100% | 1.200 | 60 | 77.679112 | +17.679112 |

All confidence cases had zero attribute-cap hits, zero OVR-cap hits, and zero discarded budget. Differences are caused only by confidence.

Recommendation: **Conservative**. One of eight votes remains non-zero but yields only `+1.12` after an implausibly persistent 20-Match run. Two of eight remain useful at `+3.58`, while 50% retains 90% of the current curve's movement and 75–100% remain unchanged. Moderate is defensible but still grants `+4.48` from two voters over 20 Matches.

## Tag blend experiments

Ten identical rating-8.5 Matches at 75% participation were simulated with `maxTagBlend=0.75` and `0.50`. No clipped budget is redistributed.

### Tags concentrated 100% in REMATE

Final attributes are ordered `VEL/PAS/REG/REM/DEF/FIS`.

| maxTagBlend | Coverage | Final attributes | Final OVR | Attribute cap hits (Match rate) | OVR cap hits | Discarded budget |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 0.75 | 0% | 68.336/68.336/68.336/68.336/68.336/68.336 | 68.335600 | 0 (0%) | 0 | 0.000000 |
| 0.75 | 25% | 66.773/66.773/66.773/74.821/66.773/66.773 | 68.114061 | 8 (80%) | 0 | 0.185728 |
| 0.75 | 50% | 65.210/65.210/65.210/75.000/65.210/65.210 | 66.841457 | 10 (100%) | 0 | 1.437632 |
| 0.75 | 75% | 63.647/63.647/63.647/75.000/63.647/63.647 | 65.539020 | 10 (100%) | 0 | 2.721641 |
| 0.75 | 100% | 62.084/62.084/62.084/75.000/62.084/62.084 | 64.236584 | 10 (100%) | 0 | 4.005650 |
| 0.50 | 0% | 68.336/68.336/68.336/68.336/68.336/68.336 | 68.335600 | 0 (0%) | 0 | 0.000000 |
| 0.50 | 25% | 67.294/67.294/67.294/73.437/67.294/67.294 | 68.317606 | 0 (0%) | 0 | 0.000000 |
| 0.50 | 50% | 66.252/66.252/66.252/75.000/66.252/66.252 | 67.709748 | 10 (100%) | 0 | 0.581626 |
| 0.50 | 75% | 65.210/65.210/65.210/75.000/65.210/65.210 | 66.841457 | 10 (100%) | 0 | 1.437632 |
| 0.50 | 100% | 64.168/64.168/64.168/75.000/64.168/64.168 | 65.973165 | 10 (100%) | 0 | 2.293638 |

Lowering to `0.50` removes saturation at 25% coverage and substantially reduces discarded budget at higher coverage, but does not fully solve the pathological single-attribute case. At 50–100% coverage, REMATE still reaches the per-Match cap every time. This is an intentional safeguard, not a reason to raise caps.

### Tags distributed REMATE 50% / REGATE 30% / VELOCIDAD 20%

| maxTagBlend | Coverage | Final attributes VEL/PAS/REG/REM/DEF/FIS | Final OVR | Attribute cap hits (Match rate) | OVR cap hits | Discarded budget |
| ---: | ---: | --- | ---: | ---: | ---: | ---: |
| 0.75 | 0% | 68.336/68.336/68.336/68.336/68.336/68.336 | 68.335600 | 0 (0%) | 0 | 0.000000 |
| 0.75 | 25% | 68.648/66.773/69.586/71.438/66.773/66.773 | 68.331641 | 0 (0%) | 0 | 0.000000 |
| 0.75 | 50% | 68.961/65.210/70.824/74.328/65.210/65.210 | 68.290323 | 4 (40%) | 0 | 0.015705 |
| 0.75 | 75% | 69.273/63.647/72.042/75.000/63.647/63.647 | 67.875928 | 10 (100%) | 0 | 0.410421 |
| 0.75 | 100% | 69.586/62.084/73.241/75.000/62.084/62.084 | 67.346411 | 10 (100%) | 0 | 0.924024 |
| 0.50 | 0% | 68.336/68.336/68.336/68.336/68.336/68.336 | 68.335600 | 0 (0%) | 0 | 0.000000 |
| 0.50 | 25% | 68.544/67.294/69.169/70.414/67.294/67.294 | 68.334706 | 0 (0%) | 0 | 0.000000 |
| 0.50 | 50% | 68.752/66.252/70.003/72.443/66.252/66.252 | 68.325581 | 0 (0%) | 0 | 0.000000 |
| 0.50 | 75% | 68.961/65.210/70.824/74.328/65.210/65.210 | 68.290323 | 4 (40%) | 0 | 0.015705 |
| 0.50 | 100% | 69.169/64.168/71.639/74.912/64.168/64.168 | 68.037305 | 8 (80%) | 0 | 0.255041 |

At `0.50`, realistic distributed evidence preserves almost all realized OVR: even 100% coverage ends only `0.298295` below no-tags, versus `0.989189` at `0.75`. FULL no longer systematically underperforms QUICK for ordinary distributed evidence. Concentrated unanimity remains deliberately constrained.

Recommendation: **reduce `maxTagBlend` from `0.75` to `0.50`**. Do not redistribute discarded budget in V1. Monitor production-like evidence for cap Match rates; if single-attribute unanimity is common rather than pathological, another calibration pass is required.

## Neutral-to-positive drift

All scenarios use 75% participation and no tags. None reaches the `+0.35` effective-signal threshold, so no positive streak ever activates.

| Rating | OVR @10 | OVR @25 | OVR @50 | OVR @100 | Positive streak | Cap hits / discarded |
| ---: | ---: | ---: | ---: | ---: | --- | --- |
| 6.00 | 60.000000 | 60.000000 | 60.000000 | 60.000000 | No | 0 / 0 |
| 6.10 | 60.224000 | 60.560000 | 61.120000 | 62.240000 | No | 0 / 0 |
| 6.25 | 60.560000 | 61.400000 | 62.800000 | 65.600000 | No | 0 / 0 |
| 6.50 | 61.120000 | 62.800000 | 65.600000 | 70.932894 | No | 0 / 0 |
| 6.75 | 61.680000 | 64.200000 | 68.400000 | 75.071999 | No | 0 / 0 |
| 7.00 | 62.240000 | 65.600000 | 70.934310 | 78.948950 | No | 0 / 0 |

Rating 6.1 is not meaningfully inflationary. Rating 6.25 adds 5.6 OVR only after 100 consistently above-neutral Matches. Rating 6.5 reaches about 71 after 100 Matches; that is material but also represents sustained positive evidence over a very long history. A new dead zone is not justified by this matrix. Real rating distributions should determine whether systematic generosity around 6.5 creates population inflation.

## Consistency vs variance

All deterministic 50-Match sequences have arithmetic mean exactly 8 and 75% participation.

| Sequence | Final OVR | Total delta | Matches with positive streak bonus | Max streak | OVR uplift attributable to streak |
| --- | ---: | ---: | ---: | ---: | ---: |
| Constant `8` | 84.267843 | +24.267843 | 48 | 50 | +2.366967 |
| Repeated `9,7,8,8` | 82.439455 | +22.439455 | 12 | 3 | +0.530900 |
| Wide deterministic `10,6,9,7,10,5,9,8…` | 82.858922 | +22.858922 | 7 | 4 | +0.190961 |

Constant versus periodic differs by `1.828388 OVR`, or `2.17%` of the constant final OVR. Relative to progression gained, constant earns `8.15%` more. Constant versus wide variance differs by `1.408921 OVR` (`1.67%` of final OVR; `6.16%` more progression gained).

Consistency receives a visible but not absurd reward. The constant sequence spends almost all Matches at the streak cap, yet the final separation remains under two OVR. No streak-parameter change is recommended from this evidence.

The wide-variance case activated the derived-OVR cap in 3/50 Matches (6%) and discarded `0.056113`; this is occasional safeguard behavior, not upstream saturation.

## Negative streak stress test

Starting from uniform OVR 85, participation 75%, no tags:

| Match | Rating | Raw | Effective | Streak before | Streak after | Multiplier | OVR delta | OVR |
| ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: |
| 1 | 8 | +0.50 | +0.50 | NONE/0 | POSITIVE/1 | 1.00 | +0.233600 | 85.233600 |
| 2 | 8 | +0.50 | +0.50 | POSITIVE/1 | POSITIVE/2 | 1.00 | +0.232105 | 85.465705 |
| 3 | 7 | +0.20 | +0.20 | POSITIVE/2 | NONE/0 | 1.00 | +0.092248 | 85.557953 |
| 4 | 8 | +0.50 | +0.50 | NONE/0 | POSITIVE/1 | 1.00 | +0.230029 | 85.787982 |
| 5 | 4 | -0.50 | -0.50 | POSITIVE/1 | NEGATIVE/1 | 1.00 | -0.299782 | 85.488200 |
| 6 | 4 | -0.50 | -0.50 | NEGATIVE/1 | NEGATIVE/2 | 1.00 | -0.298343 | 85.189856 |
| 7 | 4 | -0.50 | -0.50 | NEGATIVE/2 | NEGATIVE/3 | 1.10 | -0.326602 | 84.863254 |
| 8 | 4 | -0.50 | -0.50 | NEGATIVE/3 | NEGATIVE/4 | 1.15 | -0.339645 | 84.523609 |
| 9 | 8 | +0.50 | +0.50 | NEGATIVE/4 | POSITIVE/1 | 1.00 | +0.236649 | 84.760257 |
| 10 | 8 | +0.50 | +0.50 | POSITIVE/1 | POSITIVE/2 | 1.00 | +0.235134 | 84.995392 |
| 11 | 8 | +0.50 | +0.50 | POSITIVE/2 | POSITIVE/3 | 1.10 | +0.256992 | 85.252384 |
| 12 | 7 | +0.20 | +0.20 | POSITIVE/3 | NONE/0 | 1.00 | +0.092794 | 85.345178 |

The four-Match bad run removes `1.264373 OVR`; the streak premium accounts for roughly `0.07–0.08 OVR` beyond four isolated rating-4 deltas at this level. It is visible but does not destroy months of progress. The full 12-Match trajectory finishes `+0.345178` above its start.

For comparison, `4,8,4,8,4,8,4` never exceeds a negative streak count of 1. Its four bad Matches remove approximately `1.182 OVR` gross, while the interleaved positives recover approximately `0.708`; final OVR is `84.525365` (`-0.474635`). Recurrence is penalized modestly rather than exponentially.

Neither stress sequence activated caps or discarded budget.

## Reversibility

Starting from OVR 80, participation 75%, no tags:

| Match | Five rating-9 then five rating-4 | Five rating-4 then five rating-9 |
| ---: | ---: | ---: |
| 0 | 80.000000 | 80.000000 |
| 1 | 80.424960 | 79.728000 |
| 2 | 80.845568 | 79.457306 |
| 3 | 81.303500 | 79.160971 |
| 4 | 81.776854 | 78.852802 |
| 5 | 82.264972 | 78.533010 |
| 6 | 81.982100 | 79.136342 |
| 7 | 81.700586 | 79.732822 |
| 8 | 81.392407 | 80.379712 |
| 9 | 81.071921 | 80.863945 |
| 10 | 80.739347 | 81.363280 |

| Order | Start | Peak | Trough | Final | Net delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| Up then down | 80 | 82.264972 | 80.000000 | 80.739347 | +0.739347 |
| Down then up | 80 | 81.363280 | 78.533010 | 81.363280 | +1.363280 |

Final-state hysteresis is `0.623933 OVR`. The down-then-up path benefits from crossing into the stronger positive 70–79 band, while upward movement also exceeds downward movement by design. The difference is noticeable but not excessive across ten extreme Matches. No cap activates and no budget is discarded.

## Profile sanity check

| Example | Attributes VEL/PAS/REG/REM/DEF/FIS | LIBRE | DEFENSIVO | MEDIO | OFENSIVO | Best fit |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Attacker | 95/85/95/99/24/63 | 76.833400 | 65.780000 | 77.000000 | 86.700000 | OFENSIVO |
| Defender | 78/82/55/52/94/90 | 75.166633 | 81.800000 | 75.360000 | 68.630000 | DEFENSIVO |
| Midfielder | 80/93/90/76/80/78 | 82.833341 | 82.660000 | 84.570000 | 82.820000 | MEDIO |

Each specialization wins under its intended profile. The attacker and defender have large, explainable spreads because their weaknesses are extreme; the balanced midfielder varies by only `1.91`. No profile is inherently privileged: with six equal attributes, every profile produces the same OVR because every vector sums to one. These weights remain candidates, not frozen truth, and no `ratingProfile` inference is introduced.

## Cap telemetry

| Experiment | Matches | Attribute-cap Match rate | OVR-cap Match rate | Discarded budget |
| --- | ---: | ---: | ---: | ---: |
| Confidence curves, all 18 cases | 360 | 0% | 0% | 0 |
| Neutral drift, all six ratings | 600 | 0% | 0% | 0 |
| Consistency: constant | 50 | 0% | 0% | 0 |
| Consistency: periodic | 50 | 0% | 0% | 0 |
| Consistency: wide variance | 50 | 0% | 6% | 0.056113 |
| Negative stress | 19 | 0% | 0% | 0 |
| Reversibility | 20 | 0% | 0% | 0 |
| Tags concentrated, blend 0.75 | 50 | 76% | 0% | 8.350651 |
| Tags concentrated, blend 0.50 | 50 | 60% | 0% | 4.312896 |
| Tags distributed, blend 0.75 | 50 | 48% | 0% | 1.350150 |
| Tags distributed, blend 0.50 | 50 | 24% | 0% | 0.270746 |

The tag aggregate includes five coverage scenarios, including 0%. `maxTagBlend=0.50` halves concentrated discarded budget and reduces distributed cap-Match frequency from 48% to 24%. The remaining distributed hits occur mainly at 100% coverage and are low-budget. Concentrated evidence still frequently reaches the safeguard and should be monitored, not accommodated by raising caps.

## Findings

1. The current confidence curve is too permissive below 25% over long histories.
2. The conservative curve best satisfies sparse damping while preserving useful 50% evidence and unchanged strong 75–100% evidence.
3. `maxTagBlend=0.50` materially reduces modality bias. It sufficiently fixes distributed evidence but cannot eliminate saturation when every tag targets one attribute.
4. No dead zone above rating 6 is justified yet. Near-neutral drift is gradual and never receives a streak bonus.
5. Streak consistency creates less than two OVR separation across equal-mean 50-Match sequences. That is a meaningful but bounded reward.
6. Four consecutive bad Matches at OVR 85 remove about 1.26 OVR, not months of progression.
7. Reversibility has moderate band-boundary hysteresis (`0.62 OVR` between reversed sequences), not a blocking asymmetry.
8. Profile weights recognize the three intended specializations and remain scale-comparable.
9. Caps are occasional everywhere except concentrated tag allocation. Upstream tag blend—not higher caps—is the correct calibration lever.

## Recommended V1 defaults

These recommendations are candidates for an explicit subsequent spec/config revision. This document does not silently modify V1.

| Parameter | Current value | Proposed value | Evidence | Expected benefit | Tradeoff |
| --- | --- | --- | --- | --- | --- |
| Participation confidence | `0→0`, `.25→.45`, `.50→.75`, `.75→1`, `1→1.2` | `0→0`, `.125→.05`, `.25→.20`, `.50→.65`, `.75→1`, `1→1.2` | 1/8 over 20 Matches falls from `+5.04` to `+1.12`; 2/8 falls from `+9.46` to `+3.58`; 50% still gives `+10.95` | Prevents months of one-voter evidence from producing major progression while keeping every vote non-zero | Small groups/low-turnout Matches progress more slowly until participation reaches 50% |
| Maximum tag blend | `0.75` | `0.50` | Distributed 100% coverage ends at 68.04 instead of 67.35 versus no-tags 68.34; aggregate discarded budget falls 1.35→0.27 | FULL evidence steers attributes without routinely reducing realized progression | Tags have less power to create extreme specialization quickly |
| Near-neutral rating curve | `6→0`, `7→.20` | Keep current | Rating 6.25 adds 5.6 only after 100 Matches; rating 6.5 reaches 70.93 after 100; neither streaks | Avoids an arbitrary dead zone and preserves meaning of small positive evidence | Population drift remains possible if users systematically rate above 6 |
| Streak thresholds/multipliers | `±.35`; `1.10/1.15/1.20` | Keep current | Equal-mean sequences differ by 1.4–1.8 OVR after 50; four-bad streak premium is only ~0.08 OVR | Rewards consistency without runaway compounding | Sequence order remains intentionally relevant |
| Caps | Current per-band values | Keep current | Ordinary experiments almost never hit; only concentrated tags hit frequently | Preserves safety against extreme Match outcomes | Concentrated tag budget is discarded rather than recovered |
| Profile weights | Current candidate vectors | Keep as implementation candidates, not product-frozen | Intended specialization wins in all three sanity checks | Enables deterministic engine vectors without allowing user profile manipulation | Requires real-player validation before activation |

## Still requires real-user calibration

- Real participation distribution by roster size, especially how often 1/8 and 2/8 occur.
- Actual rating distribution and generosity around 6–7.
- Real QUICK/FULL mix and tag-coverage distribution.
- Frequency of unanimous single-attribute tags.
- Acceptable Match cadence and time-to-70/80/90.
- Profile vectors using recognizable real player archetypes.
- Fixed-decimal precision and exact golden vectors for production determinism.
- Operational threshold for acceptable attribute-cap Match frequency.

## Go / No-Go for engine implementation

**GO FOR ENGINE**, with a strict distinction between implementing deterministic mechanics and activating product calibration.

Reasons:

- the mathematical architecture remained stable across every experiment;
- the two observed calibration defects have bounded parameter-level remedies: conservative confidence and `maxTagBlend=0.50`;
- neutral drift, streak asymmetry, reversibility, profiles, and caps show no structural blocker;
- the exploratory script now supplies reproducible vectors for engine tests;
- remaining uncertainty depends on real-user distributions and can be handled by immutable versioned configuration before activation.

The engine should not be implemented automatically from this report, and these proposed values should not become active product truth without an explicit configuration/spec decision.
