# Known release risks

Snapshot for the `v0.1.0-rc.1` rehearsal candidate on 2026-09-01.

| Severity | Risk | Impact | Mitigation | Launch decision |
| --- | --- | --- | --- | --- |
| P1 | The complete release source exists only in a large uncommitted worktree; local base `b4bff7b` differs from remote `main` (`e3b5435`). | The artifact cannot be reproduced, reviewed, tagged or matched to a real CI run. | Commit the intended source, review the diff, push one SHA, rerun CI and build immutable artifacts from that SHA. | Block beta. |
| P1 | No real/staging SMTP credentials or sender identity are configured. | New accounts cannot reliably verify email and password recovery cannot be proven. The failure rehearsal returned a normal signup response but logged the delivery failure, leaving the user waiting for mail. | Configure provider credentials, domain/sender authentication and alerts; complete verification and reset smokes. | Block beta. |
| P1 | No real/staging private MinIO/S3 bucket is configured. | Avatar upload/delivery/delete and production storage readiness are unproven; `prod:check` correctly fails the real HeadBucket probe. | Provision a private bucket, scoped credentials and HTTPS endpoint; run the complete avatar lifecycle smoke. | Block beta. |
| P1 | Media has no tested off-host snapshot/versioning/mirror. | A host or volume loss can leave restored DB media references without objects. | Enable provider versioning/snapshot or scheduled `mc mirror` to a second failure domain and perform a recovery drill aligned with a DB backup. | Block beta while avatars are launch scope. |
| P1 | Current source has no real CI run and cannot be represented by the remote branch. | Local success may not reproduce on the Linux CI runner or clean remote checkout. | Push the immutable candidate and require green validate + E2E jobs. | Block beta. |
| P1 | Docker is unavailable on this host and no image build evidence exists for the current source. | Container entrypoints, copied artifacts and runtime ownership remain structurally reviewed but unexecuted. | Build all three image targets in CI or a Docker-capable staging host and smoke them. | Block containerized beta deploy. |
| P1 | Terms/Privacy text has not received professional legal review. | Technical consent can work while wording, retention or jurisdiction obligations remain inadequate. | Obtain external legal review and version any required wording changes before invitations. | External launch sign-off required. |
| P1 | Authenticated human end-to-end sign-off with real SMTP/storage on a mobile device is incomplete. | Automation may miss device/browser interaction or external-service integration failures in the actual launch environment. | Run the release checklist on staging at 390 px/physical mobile and 1440 px after SMTP/MinIO are configured. | Block final beta approval. |
| P2 | V1 permits exactly one API instance because auth/upload/report limiters are in memory. | No API replica failover; a restart clears temporary counters. | Enforce one instance operationally. Add a shared limiter only before horizontal scaling. | Accepted for a small beta under ADR-017. |
| P2 | Browser automation is Chromium-only; Edge/Firefox/Safari release smokes are outstanding. | Browser-specific layout or API incompatibilities may escape current tests. | Run short deployed smokes in Edge and Firefox/Safari; fix only demonstrated P0/P1 issues before release. | Must be recorded; can be waived only explicitly for closed beta. |
| P2 | Performance rehearsal covers rollback-only 1k Players / 100 Groups / 1k Matches, not the preferred 5k/500/10k pass. | Higher-volume plan changes are not measured, although current queries remain bounded and fast locally. | Repeat the measurement script with a larger dedicated fixture in a future capacity rehearsal; monitor production latency. | Acceptable for initial beta volume. |
| P2 | PostgreSQL backups are proven locally but no scheduled encrypted off-host retention job is configured. | The manual procedure works, but missed schedules or host loss could remove recovery points. | Configure daily/weekly/monthly retention outside the app host and alert on failures. | Must be configured before storing real beta data. |
| P3 | Local Playwright output contains benign `NO_COLOR`/`FORCE_COLOR` warnings. | No product or test correctness impact. | Clean up runner environment when convenient. | Backlog. |

No P0 data-integrity or authorization defect remained after the rehearsal. One
P0 operational defect was found and fixed: the Windows backup process could
wait indefinitely before connecting. The backup script now passes explicit
libpq connection variables and closes stdin; a real dump and restore succeeded
after the fix.
