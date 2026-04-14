# Contributing

## Branch naming

Format: `<type>/T-<phase>.<num>-<short-slug>`

- `type` — one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`, `style`, `revert`
- `T-<phase>.<num>` — matches the task ID from the issue (e.g. `T-1.3`)
- `short-slug` — kebab-case, ≤5 words

Examples:

```
feat/T-1.3-crypto-service
feat/T-2.5-quality-scorer
fix/T-4.6-sse-abort-leak
chore/T-0.1-turborepo-scaffold
test/T-3.3-validator-branch-coverage
```

Long-lived branches: `main` (protected), `staging` (optional release train).

## Commit messages — Conventional Commits

Format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Rules:

- **type** — same set as branch types above
- **scope** — module letter or package name: `api`, `web`, `cli`, `auth`, `analytics`, `policy`, `generate`, `infra`, `db`, `contracts`, `shared`
- **subject** — imperative, ≤50 chars, no trailing period, lowercase
- **body** — wrap at 72 chars; explain *why*, not *what*
- **footer** — `Refs #<issue>` (required) or `Closes #<issue>` when the commit finishes the task; `BREAKING CHANGE: <desc>` when applicable

Examples:

```
feat(auth): add AES-GCM crypto service for api keys

Refs #12
```

```
fix(generate): release SSE stream on client abort

Previously the LLM provider kept generating after the HTTP client
disconnected, billing tokens for work the user cancelled.

Closes #47
```

```
feat(policy)!: require body+footer for breaking-change commits

BREAKING CHANGE: policies created before this change will reject
commits they previously allowed. Re-run the migration to relax.

Refs #31
```

## Pull requests

- One PR per task (one issue).
- PR title = the commit subject (Conventional Commits format).
- PR body must include `Closes #<issue>` to auto-close on merge.
- Squash-merge by default; the squash commit message must itself be a valid Conventional Commit.
- Keep PRs ≤400 lines of diff where possible. Split by sub-task if larger.

## Branch protection on `main`

`main` is protected. Merge is blocked until the following required status checks pass on the PR head commit:

- `Lint`, `Typecheck`, `Unit tests` (from `ci.yml`)
- `branch-name`, `commitlint`, `pr-lint` (from `pr-hygiene.yml`)

Additional rules:

- Branches must be up to date with `main` before merging (`strict: true`).
- Force pushes and branch deletion are blocked.
- Linear history is required; resolve conversations before merge.

This is what gates the production deploys in `deploy-web.yml` / `deploy-api.yml` — those workflows trigger on `push: main`, so the CI gate must be enforced *before* code reaches `main`.

## Before pushing

- `pnpm lint && pnpm typecheck && pnpm test` must pass.
- New business logic needs unit tests; new endpoints need integration tests; new UI flows need Playwright coverage (per `10-testing.md`).

## Secrets

Never commit `.env*` files, API keys, tokens, or real Supabase/LLM credentials. `.env.example` only.
