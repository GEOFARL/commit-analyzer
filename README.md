# commit-analyzer

AI-assisted commit message generator with git analytics, policy validation, and a CLI + web dashboard.

## Stack

Turborepo monorepo · NestJS API · Next.js web · ts-rest contracts · BullMQ · Supabase (Postgres + Auth + RLS) · Vercel AI SDK · Playwright.

## Quickstart

Requires Node 20, pnpm 9.12+, and Docker.

```bash
pnpm install
docker compose up -d
pnpm dev
```

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md) for commit conventions, branch naming, and workflow.

Specification documents live outside the repo (thesis project) and are intentionally gitignored. Tasks are tracked as GitHub issues grouped by phase milestones.

## Deployment

Continuous deployment runs from `main` via GitHub Actions:

- `deploy-web` — Vercel (triggered on `apps/web/**`, `packages/**`)
- `deploy-api` — Railway (triggered on `apps/api/**`, `packages/**`)

Each workflow logs a skip notice and exits green when its secrets are absent, so the pipeline stays non-blocking until infra is provisioned.

Required repository secrets:

| Workflow     | Secrets                                               |
| ------------ | ----------------------------------------------------- |
| `deploy-web` | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`  |
| `deploy-api` | `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID_API`             |

Health checks are driven by repository variables (not secrets):

| Variable          | Example                                                 |
| ----------------- | ------------------------------------------------------- |
| `WEB_HEALTH_URL`  | `https://commit-analyzer.vercel.app/`                   |
| `API_HEALTH_URL`  | `https://poetic-luck-production.up.railway.app/health`  |

Live environments:

- Web → <https://commit-analyzer.vercel.app>
- API → <https://poetic-luck-production.up.railway.app/health>

## Status

In development. See [issues](../../issues) and [milestones](../../milestones) for current phase progress.
