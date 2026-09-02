# Read-model performance findings

Integration 30 measures the launch read models with a rollback-only dataset:
1,000 Players, 100 Groups and 1,000 Matches.

The structural finding before measurement was a real `1 + N` request pattern
in `/play`: one Group request followed by one Match request per Group. It was
replaced by bounded `GET /me/matches`, which resolves upcoming and recent
Matches server-side and returns only the personal dashboard projection.

Measurement command:

```bash
pnpm perf:read-models
```

The script accepts only a database whose name ends in `_e2e` or `_perf`, creates
the dataset inside one transaction, executes `EXPLAIN (ANALYZE, BUFFERS)` and
rolls the transaction back. On the local PostgreSQL run used to close
Integration 30, warm-cache observations were:

| Projection | Planning | Execution | Shared reads |
| --- | ---: | ---: | ---: |
| Personal Matches preview | 1.307 ms | 1.095 ms | 0 |
| Global F5 Ranking preview | 1.097 ms | 2.653 ms | 0 |
| Player Search (`ILIKE`, bounded) | 0.082 ms | 0.649 ms | 0 |

These are local diagnostic observations, not production latency SLOs. The
plans and timings did not justify a new index. Search remains PostgreSQL
`ILIKE`; no trigram extension or external search service is introduced without
evidence. Other launch read models retain bounded limits/keyset pagination and
their existing integration coverage; broader load testing remains part of the
release rehearsal rather than a reason to add speculative infrastructure here.
