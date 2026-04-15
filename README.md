# commit-analyzer

AI-assisted commit message generator with git analytics, policy validation, and a CLI + web dashboard.

## Stack

Turborepo monorepo · NestJS API · Next.js web · ts-rest contracts · BullMQ · Supabase (Postgres + Auth + RLS) · Vercel AI SDK · Playwright.

## Quickstart

Requires Node 20, pnpm 9.12+, Docker, and a Supabase account.

### 1. Provision a dev Supabase project

Local dev must NOT point at the prod Supabase project — every migration or destructive query would hit real user data. Create a separate free-tier project (e.g. `commit-analyzer-dev`) and capture:

- Project URL: `https://<ref>.supabase.co`
- Publishable (anon) key and service role key: Dashboard → Settings → API
- Transaction pooler connection string (port 6543): Dashboard → Settings → Database

### 2. Register a dev GitHub OAuth app

Create a dedicated OAuth app at <https://github.com/settings/developers> with:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/auth/callback`

Keep the prod OAuth app separate so rotating one doesn't break the other.

### 3. Bootstrap env files

The `apps/api` and `apps/web` apps each load their own env file. Start from the root template:

```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local   # only the NEXT_PUBLIC_* keys are read here
```

Fill in the values from steps 1–2, then generate a fresh encryption key (do **not** reuse prod's — it would let prod-encrypted rows decrypt in dev):

```bash
openssl rand -base64 32   # paste into ENCRYPTION_KEY_BASE64 in apps/api/.env
```

### 4. Run the schema migrations against dev

```bash
cd packages/database
DATABASE_URL="<dev pooler connection string>" DATABASE_SSL=true pnpm migration:run
```

### 5. Boot the stack

```bash
pnpm install
docker compose up -d   # Redis only — Postgres is hosted by Supabase
pnpm dev
```

Web runs on <http://localhost:3000>, API on <http://localhost:4000>.

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
| `deploy-api` | `RAILWAY_API_TOKEN`, `RAILWAY_SERVICE_ID_API`         |

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
