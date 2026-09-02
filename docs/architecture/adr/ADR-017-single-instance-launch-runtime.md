# ADR-017: Single-instance API launch runtime

## Status

Accepted for the initial production release.

## Decision

The V1 production topology runs exactly one Fastify API instance behind a trusted
HTTPS reverse proxy. Web and Admin may be deployed independently. PostgreSQL,
SMTP and private S3-compatible object storage are external runtime dependencies.

Authentication, upload and abuse-report rate limits remain in memory for V1.
Horizontal API scaling is prohibited until those limiters use a shared store.
Migrations run once as a deploy job, never from API startup. Readiness requires
database connectivity and the exact repository migration timestamp.

## Consequences

- The launch runtime is simple and reproducible without Redis or orchestration.
- An API process restart resets temporary rate-limit counters.
- API availability has no replica failover in V1.
- Horizontal scale requires a shared limiter and reviewed connection budget.
- Migrations are forward-only and app rollback must honor schema compatibility.
