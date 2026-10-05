# Local development

The controller's dependencies run in Docker: PostgreSQL 16 and a Temporal dev server. Everything else (the apps and packages) runs on the host with pnpm.

## Prerequisites

- Node 22.12 or newer
- pnpm, pinned by the `packageManager` field in `package.json`. Run `corepack enable` once and the right version is installed on first use.
- Docker with Compose v2

## First run

```sh
cp .env.example .env        # then fill in values; see "Environment variables"
pnpm install
docker compose up -d --wait # returns once both services report healthy
pnpm db:migrate
pnpm typecheck && pnpm lint && pnpm test
```

## Services

| Service | Image | Host address | Data volume |
|---|---|---|---|
| `postgres` | `postgres:16.9` | `localhost:5432` (user, password and database all `switchyard`) | `postgres-data` |
| `temporal` | `temporalio/temporal:1.9.1` (`temporal server start-dev`) | gRPC `localhost:7233`, Web UI <http://localhost:8233> | `temporal-data` (SQLite file) |

Ports bind to `127.0.0.1` only. The Postgres credentials are local development values that match CI; they are not secrets.

Temporal runs as the image's non-root `temporal` user. Its volume is mounted on that user's home directory so the volume inherits the right ownership. Workflow history and namespaces persist across `docker compose restart`.

## Common tasks

```sh
docker compose ps                  # status and health
docker compose logs -f temporal    # follow logs
docker compose down                # stop, keep data
docker compose down -v             # stop and delete all local data
docker compose exec postgres psql -U switchyard -d switchyard
docker compose exec temporal temporal workflow list --address localhost:7233
```

## Environment variables

`.env.example` documents every variable. Copy it to `.env`, which is gitignored.

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | Migrations, API, worker, DB tests | The default matches `compose.yaml` |
| `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE` | Worker, API | The defaults match `compose.yaml` |
| `TEMPORAL_API_KEY` | Worker, API when deployed | Empty locally. Temporal Cloud API key in Railway variables (ADR-0009) |
| `RAILWAY_API_TOKEN`, `RAILWAY_WORKSPACE_ID` | Spikes, live adapter tests (`LIVE_RAILWAY=1`) | Must be scoped to the **demo workspace only**. Unit tests never need them |
| `WEBHOOK_SHARED_SECRET` | Webhook receiver (M2) | Random value, for example `openssl rand -hex 32` |

Never paste real tokens into logs, fixtures, issues or PRs. See [CLAUDE.md](../../CLAUDE.md) and [SECURITY.md](../../SECURITY.md).

## Troubleshooting

- **Port already in use.** Another Postgres or Temporal is running locally. Stop it, or change the host side of the port mapping and update `.env` to match.
- **Temporal exits with `unable to open database file`.** The data volume is owned by the wrong user, which can happen with a volume created by an older `compose.yaml`. Run `docker compose down -v` and start again.
- **`pnpm: command not found`.** Run `corepack enable`.
