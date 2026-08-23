# Motion System

## Principle

Motion communicates state and reward.

Do not animate everything.

## Motion categories

### Micro

Examples:

- press;
- toggle;
- selection;
- tab;
- roster check.

Fast and subtle.

### Feedback

Examples:

- joined match;
- moved to waitlist;
- promoted to confirmed;
- vote submitted.

Clear but restrained.

### Transition

Examples:

- match lifecycle state;
- switching profile sections;
- card comparison;
- opening post-match results.

### Celebration

Reserved for:

- new tier/card;
- important achievement;
- major award;
- personal-best milestone.

Celebration should feel special because it is rare.

## Progression Reveal

Recommended sequence concept:

1. show previous card;
2. show match performance context;
3. reveal stat deltas progressively;
4. update OVR;
5. transition to new card;
6. if tier changed, run celebration;
7. reveal awards/achievements;
8. offer profile/history navigation.

Exact choreography is a visual-prototype decision.

## No forced positive movement

If OVR stays unchanged:

- animate relevant stat changes;
- clearly show stable OVR.

If evidence is insufficient:

- communicate that honestly;
- no fake reward animation.

## Reduced motion

Every celebratory flow needs a reduced-motion alternative that preserves:

- information;
- hierarchy;
- completion state.

## Timing tokens

Durations/easings belong to the design system.

Features must not invent arbitrary animation timings.

## Performance

Prefer GPU-friendly transforms/opacity where practical.

Avoid motion that causes expensive layout churn on low-end mobile devices.
