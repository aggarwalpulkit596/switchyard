# 005: Local dev environment

Issue #5 · PR #22 · Related: ADR-0009, RFC-0001 §4, `docs/engineering/local-dev.md`

## Read

**Image vs container.** An image is a read-only filesystem plus metadata (entrypoint, default user). A container is a running instance of it with a thin writable layer that disappears when the container is removed. Anything that must outlive the container goes in a **volume**.

**Named volume vs bind mount.**
- A *bind mount* maps a host directory in, so you see the files on your disk.
- A *named volume* (`postgres-data:`) is storage that Docker manages. When an **empty** named volume is mounted on a path that already **exists in the image**, Docker copies that directory's contents and ownership into it. If the path doesn't exist in the image, Docker creates it owned by root. That detail caused our crash below.

**Compose.** `compose.yaml` declares services, ports, volumes and healthchecks, so `docker compose up` gives everyone the same stack. The services share a default network and reach each other by service name.

**Healthchecks and `--wait`.** "Container started" isn't "service ready": Postgres needs seconds to initialize. A healthcheck is a command Docker runs periodically (`pg_isready`, `temporal operator cluster health`). `docker compose up --wait` returns only when every service is healthy, which makes it safe to script `up` followed by `db:migrate`.

**Port publishing.** `"5432:5432"` listens on all host interfaces, so anyone on your Wi-Fi can reach the database. `"127.0.0.1:5432:5432"` listens on loopback only. On Linux, Docker's published ports are known to bypass host firewalls like ufw, which makes the explicit bind the reliable control.

**Temporal dev server.** `temporal server start-dev` is the whole Temporal service in one process: frontend (gRPC on 7233), history and matching services, a Web UI (8233), and SQLite persistence. It isn't for production, but it has the same API, so worker code written against it runs unchanged against Temporal Cloud or a self-hosted cluster.

## Understand

Switchyard's worker (#10, #13, #14) needs Temporal, and the schema (#6) needs Postgres. Both should behave identically for anyone who clones the repo, and match CI where CI runs them. Keeping Temporal's storage (SQLite) separate from controller data (Postgres) mirrors the production shape in RFC-0001 §4, where Temporal is its own dependency. Where Temporal runs in production is #4.

## Decide

| Decision | Options | Chosen | Why |
|---|---|---|---|
| Image versions | `latest` · major (`16`) · exact (`16.9`, `1.9.1`) | Exact | Reproducible. A `latest` change shouldn't break local dev silently. The cost is bumping deliberately |
| Temporal persistence | In-memory · SQLite file · the Postgres container | SQLite on a volume | Survives restarts; doesn't mix Temporal tables into controller data |
| Container user for Temporal | root (`user: "0:0"`) · the image's `temporal` user | Non-root | Least privilege. Root "worked" but hid a permissions problem instead of solving it |
| Port binding | All interfaces · loopback | `127.0.0.1` | Dev credentials are public (`switchyard/switchyard`), so the port must not be |
| Postgres credentials in the repo | Secret · fixed dev values | Fixed dev values matching CI | Local-only, loopback-bound. Real secrets stay in `.env` and Railway |

## Execute

**Verification.** Healthy status alone wasn't accepted as proof. We checked:
- `select version()` → `PostgreSQL 16.9`
- the Temporal UI returned HTTP 200
- the `default` namespace exists
- both ports are reachable from the host
- a table *and* a registered Temporal namespace survived `docker compose restart`

**Break 1: Temporal crashed after switching to non-root.**
- *Symptom:* `unable to create SQLite admin DB: unable to open database file (14)`.
- *Cause:* the volume was mounted at `/home/temporal/data`, which doesn't exist in the image, so Docker created it owned by root. The `temporal` user (uid 1000) couldn't write there.
- *Fix:* mount the volume on `/home/temporal`, which exists in the image and is owned by uid 1000, so the new volume inherits that ownership.
- *Lesson:* read the error literally (SQLite code 14 is "can't open") and inspect the thing it names (`ls -ld` on the mount point). Running as root would have silenced the symptom and kept the flaw.

**Break 2: the persistence check was itself broken.**
- *Symptom:* after the restart, the Temporal namespace appeared to be missing.
- *Cause:* the check stored a command in a variable, `T="docker compose exec … temporal"`, and ran `$T …`. zsh, unlike bash, doesn't split unquoted variables into words, so it looked for a program literally named `docker compose exec …`. The earlier run hid that error by redirecting it to `/dev/null`. Temporal was fine; the check never ran.
- *Fix:* use a shell function and look at the output unfiltered.
- *Lesson:* before trusting a failing *or passing* check, confirm it actually executed. Silencing stderr in a verification step removes the evidence you need.

## Check yourself
1. Why would `pg_isready` be a better readiness signal than "the container is running"?
2. You mount a new named volume at `/srv/app/cache`, which doesn't exist in the image. Who owns it, and what fails if the app runs as uid 1000?
3. What's the practical difference between publishing `5432:5432` and `127.0.0.1:5432:5432`?
4. Why is the dev server's SQLite store fine locally but not a production answer?
5. A verification script prints nothing and exits 0. What would you check before believing it passed?

## My notes
