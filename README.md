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

## Status

In development. See [issues](../../issues) and [milestones](../../milestones) for current phase progress.
