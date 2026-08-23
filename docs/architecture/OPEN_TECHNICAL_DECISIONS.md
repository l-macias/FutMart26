# Technical Decisions Status

The three major pre-scaffold decisions are now closed.

| Area             | Decision                 | ADR     |
| ---------------- | ------------------------ | ------- |
| Web architecture | Next.js 16               | ADR-001 |
| Database access  | Drizzle ORM + PostgreSQL | ADR-002 |
| Authentication   | Better Auth              | ADR-003 |
| Domain API       | Fastify                  | ADR-004 |

## Remaining implementation-level decisions

These do not block repository scaffold and should be decided only when required:

- exact test runner/configuration;
- exact lint/format details;
- object-storage provider for production;
- deployment provider;
- email provider;
- job/queue implementation;
- error-reporting provider;
- final UI font families;
- final visual token values.

Do not prematurely turn these into architecture projects.
